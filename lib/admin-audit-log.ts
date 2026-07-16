import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";

export const AUDIT_ACTIONS = [
  "identity_verification_decision",
  "listing_verification_decision",
  "identity_document_accessed",
  "listing_video_accessed",
  "account_suspended",
  "account_unsuspended",
  "listing_suspended",
  "report_handled",
  "report_dismissed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  identity_verification_decision: "Décision de vérification d'identité",
  listing_verification_decision: "Décision de vérification de logement",
  identity_document_accessed: "Accès à un document d'identité",
  listing_video_accessed: "Accès à une vidéo de logement",
  account_suspended: "Suspension de compte",
  account_unsuspended: "Levée de suspension",
  listing_suspended: "Suspension d'annonce",
  report_handled: "Signalement traité",
  report_dismissed: "Signalement rejeté",
};

/**
 * Journalise un accès admin à un document sensible (pièce d'identité, selfie,
 * document d'entité, vidéo de logement) — jamais son contenu. Best-effort :
 * une erreur ne doit jamais empêcher l'admin de consulter le document dont
 * l'URL signée vient d'être générée (voir log_document_access() côté SQL,
 * qui applique la même règle : le journal ne bloque jamais l'action tracée).
 */
export async function logDocumentAccess(
  action: "identity_document_accessed" | "listing_video_accessed",
  targetType: "verification_request" | "listing_verification",
  targetId: string,
  targetUserId: string,
  detail: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("log_document_access", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_target_user_id: targetUserId,
    p_detail: detail,
  });
  if (error) {
    console.error("Échec de la journalisation d'accès document :", error);
  }
}

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetUserId: string | null;
  targetUserName: string | null;
  detail: string | null;
}

export interface AuditLogFilters {
  action?: AuditAction;
  actorId?: string;
  targetUserId?: string;
}

/** Journal d'audit chronologique, filtrable. Admin uniquement (RLS). */
export async function getAuditLog(filters: AuditLogFilters = {}, limit = 100): Promise<AuditLogEntry[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, actor_id, action, target_type, target_id, target_user_id, detail")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.targetUserId) query = query.eq("target_user_id", filters.targetUserId);

  const { data, error } = await query;
  if (error || !data) return [];

  // Pas de jointure embarquée : audit_log a deux chemins vers profiles
  // (actor_id et target_user_id), donc un embed serait ambigu — même
  // contrainte que reports (lib/admin-reports.ts).
  const profileIds = [...new Set([...data.map((r) => r.actor_id), ...data.map((r) => r.target_user_id).filter((id): id is string => !!id)])];
  const { data: profilesData } =
    profileIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", profileIds) : { data: [] };
  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.full_name ?? "Utilisateur"]));

  return data.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorId: row.actor_id,
    actorName: nameById.get(row.actor_id) ?? "Utilisateur",
    action: row.action as AuditAction,
    targetType: row.target_type,
    targetId: row.target_id,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_id ? nameById.get(row.target_user_id) ?? "Utilisateur" : null,
    detail: row.detail,
  }));
}

/** Liste des admins ayant écrit au moins une ligne, pour le filtre "par acteur". */
export async function getAuditLogActors(): Promise<{ id: string; name: string }[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase.from("audit_log").select("actor_id");
  if (error || !data) return [];

  const actorIds = [...new Set(data.map((r) => r.actor_id))];
  if (actorIds.length === 0) return [];

  const { data: profilesData } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
  return (profilesData ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Utilisateur" }));
}
