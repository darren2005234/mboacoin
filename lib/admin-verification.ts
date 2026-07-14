import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";

export interface PendingVerification {
  id: string;
  userId: string;
  userName: string;
  documentType: string | null;
  documentUrl: string;
  /** true si le document a été purgé (loi n°2024/017) — jamais le cas pour une demande "en_attente", mais gardé par précaution si cette fonction est un jour réutilisée pour un historique. */
  documentPurged: boolean;
  selfieUrl: string;
  selfiePurged: boolean;
  isPdf: boolean;
  createdAt: string;
  entityDocumentUrl: string | null;
  entityDocumentPurged: boolean;
  entityDocumentType: string | null;
  entityIsPdf: boolean;
}

/** Nombre de demandes de vérification d'identité en attente (admin uniquement, comptage léger). */
export async function getPendingVerificationsCount(): Promise<number> {
  const guard = await requireAdminClient();
  if (!guard.ok) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from("verification_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "en_attente");

  return count ?? 0;
}

/** Liste les demandes de vérification en attente (admin uniquement). */
export async function getPendingVerifications(): Promise<PendingVerification[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();

  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      "id, user_id, document_path, selfie_path, document_type, entity_document_path, entity_document_type, created_at, profiles(full_name)"
    )
    .eq("status", "en_attente")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const results: PendingVerification[] = [];
  for (const row of data) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    // Garde de conformité (loi n°2024/017) : un document purgé n'a plus de
    // storage_path — ne jamais appeler createSignedUrl sur un chemin absent,
    // l'UI doit afficher "Document purgé" plutôt que planter ou masquer
    // silencieusement l'absence. Voir components ci-dessous pour le libellé.
    let documentUrl = "";
    let isPdf = false;
    const documentPurged = !row.document_path;
    if (row.document_path) {
      const { data: signed } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(row.document_path, 3600);
      documentUrl = signed?.signedUrl ?? "";
      isPdf = row.document_path.toLowerCase().endsWith(".pdf");
    }

    let selfieUrl = "";
    const selfiePurged = !row.selfie_path;
    if (row.selfie_path) {
      const { data: signedSelfie } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(row.selfie_path, 3600);
      selfieUrl = signedSelfie?.signedUrl ?? "";
    }

    // entity_document_type non nul = un document d'entité a été soumis à un
    // moment donné ; s'il n'a plus de storage_path, c'est qu'il a été purgé
    // (à distinguer du cas normal où aucun document d'entité n'a jamais été
    // demandé, où entity_document_type est aussi null).
    let entityDocumentUrl: string | null = null;
    let entityIsPdf = false;
    const entityDocumentPurged = Boolean(row.entity_document_type) && !row.entity_document_path;
    if (row.entity_document_path) {
      const { data: signedEntity } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(row.entity_document_path, 3600);
      entityDocumentUrl = signedEntity?.signedUrl ?? "";
      entityIsPdf = row.entity_document_path.toLowerCase().endsWith(".pdf");
    }

    results.push({
      id: row.id,
      userId: row.user_id,
      userName: profile?.full_name ?? "Utilisateur",
      documentType: row.document_type,
      documentUrl,
      documentPurged,
      selfieUrl,
      selfiePurged,
      isPdf,
      createdAt: row.created_at,
      entityDocumentUrl,
      entityDocumentPurged,
      entityDocumentType: row.entity_document_type,
      entityIsPdf,
    });
  }
  return results;
}

/** Valide une demande : profil vérifié + demande validée. */
export async function approveVerification(requestId: string, userId: string) {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("verification_requests")
    .update({ status: "validee", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("profiles")
    .update({ verification: "verifie" })
    .eq("id", userId);
  if (e2) return { error: e2.message };

  return { success: true };
}

/** Rejette une demande avec un motif. */
export async function rejectVerification(requestId: string, userId: string, reason: string) {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("verification_requests")
    .update({ status: "rejetee", reviewed_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", requestId);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("profiles")
    .update({ verification: "rejete" })
    .eq("id", userId);
  if (e2) return { error: e2.message };

  return { success: true };
}