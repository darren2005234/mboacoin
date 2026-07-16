import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";
import { friendlyErrorMessage } from "@/lib/supabase-error";
import { REPORT_USER_REASON_LABELS } from "@/lib/reports";

export interface PendingReport {
  id: string;
  targetType: "listing" | "user";
  targetId: string;
  targetLabel: string;
  reporterName: string;
  reason: string;
  details: string | null;
  createdAt: string;
  /** Nombre de signalements distincts reçus par la cible (uniquement pour un compte). */
  targetReceivedCount: number | null;
  /** Nombre de signalements émis par ce signaleur, tous types confondus (détection d'abus). */
  reporterEmittedCount: number;
}

/** Nombre de signalements en attente (admin uniquement, comptage léger). */
export async function getPendingReportsCount(): Promise<number> {
  const guard = await requireAdminClient();
  if (!guard.ok) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "ouvert");

  return count ?? 0;
}

/** Liste les signalements en attente, avec le libellé de la cible et le nom du signaleur (admin uniquement). */
export async function getPendingReports(limit = 50): Promise<PendingReport[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("id, reporter_id, listing_id, reported_user_id, reason, details, created_at")
    .eq("status", "ouvert")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  // Pas de jointure embarquée : `reports` a deux chemins vers `profiles` (reporter_id et
  // reported_user_id), donc un embed serait ambigu. Deux requêtes séparées + fusion en JS.
  const reporterIds = [...new Set(data.map((r) => r.reporter_id))];
  const reportedUserIds = [...new Set(data.map((r) => r.reported_user_id).filter((id): id is string => !!id))];
  const listingIds = [...new Set(data.map((r) => r.listing_id).filter((id): id is string => !!id))];

  const allProfileIds = [...new Set([...reporterIds, ...reportedUserIds])];

  const [{ data: profilesData }, { data: listingsData }, { data: statsData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", allProfileIds),
    listingIds.length > 0
      ? supabase.from("listings").select("id, title").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    // Détection d'abus : combien ce compte a reçu de signalements, combien il en a émis.
    supabase.rpc("get_report_stats_for_users", { p_user_ids: allProfileIds }),
  ]);

  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.full_name ?? "Utilisateur"]));
  const titleById = new Map((listingsData ?? []).map((l) => [l.id, l.title]));
  const statsById = new Map(
    ((statsData ?? []) as { user_id: string; received_count: number; emitted_count: number }[]).map((s) => [
      s.user_id,
      s,
    ])
  );

  return data.map((row) => {
    const isListing = row.listing_id != null;
    return {
      id: row.id,
      targetType: isListing ? "listing" : "user",
      targetId: isListing ? row.listing_id! : row.reported_user_id!,
      targetLabel: isListing ? titleById.get(row.listing_id!) ?? "Annonce" : nameById.get(row.reported_user_id!) ?? "Utilisateur",
      reporterName: nameById.get(row.reporter_id) ?? "Utilisateur",
      reason: isListing ? row.reason : REPORT_USER_REASON_LABELS[row.reason] ?? row.reason,
      details: row.details,
      createdAt: row.created_at,
      targetReceivedCount: isListing ? null : statsById.get(row.reported_user_id!)?.received_count ?? 1,
      reporterEmittedCount: statsById.get(row.reporter_id)?.emitted_count ?? 1,
    };
  });
}

/** Marque un signalement comme traité, sans action supplémentaire sur la cible. */
export async function markReportHandled(reportId: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.from("reports").update({ status: "traite" }).eq("id", reportId);
  if (error) return { error: friendlyErrorMessage(error, "Impossible de traiter ce signalement. Réessayez.") };
  return { success: true };
}

/** Marque un signalement comme non fondé. */
export async function dismissReport(reportId: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.from("reports").update({ status: "rejete" }).eq("id", reportId);
  if (error) return { error: friendlyErrorMessage(error, "Impossible de rejeter ce signalement. Réessayez.") };
  return { success: true };
}

/** Suspend l'annonce signalée et clôt le signalement dans la foulée. */
export async function suspendReportedListing(
  reportId: string,
  listingId: string
): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();

  const { error: e1 } = await supabase.from("listings").update({ status: "suspendue" }).eq("id", listingId);
  if (e1) return { error: friendlyErrorMessage(e1, "Impossible de suspendre cette annonce. Réessayez.") };

  const { error: e2 } = await supabase.from("reports").update({ status: "traite" }).eq("id", reportId);
  if (e2) return { error: friendlyErrorMessage(e2, "Impossible de traiter ce signalement. Réessayez.") };

  return { success: true };
}

export interface ReceivedReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

/** Signalements reçus par un compte, avec l'identité du signaleur (« de la part de qui »). Admin uniquement. */
export async function getReportsReceived(userId: string): Promise<ReceivedReport[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_reports_received", { p_user_id: userId });
  if (error || !data) return [];

  return (data as {
    id: string; reporter_id: string; reporter_name: string | null; reason: string;
    details: string | null; status: string; created_at: string;
  }[]).map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name ?? "Utilisateur",
    reason: REPORT_USER_REASON_LABELS[row.reason] ?? row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/** Suspend le compte signalé (motif interne) et clôt le signalement dans la foulée. */
export async function suspendReportedUser(
  reportId: string,
  userId: string,
  reason: string
): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();

  const { error: e1 } = await supabase.rpc("suspend_account", { p_user_id: userId, p_reason: reason });
  if (e1) return { error: friendlyErrorMessage(e1, "Impossible de suspendre ce compte. Réessayez.") };

  const { error: e2 } = await supabase.from("reports").update({ status: "traite" }).eq("id", reportId);
  if (e2) return { error: friendlyErrorMessage(e2, "Impossible de traiter ce signalement. Réessayez.") };

  return { success: true };
}
