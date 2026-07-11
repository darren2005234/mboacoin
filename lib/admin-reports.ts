import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";

export interface PendingReport {
  id: string;
  targetType: "listing" | "user";
  targetId: string;
  targetLabel: string;
  reporterName: string;
  reason: string;
  details: string | null;
  createdAt: string;
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

  const [{ data: profilesData }, { data: listingsData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", [...new Set([...reporterIds, ...reportedUserIds])]),
    listingIds.length > 0
      ? supabase.from("listings").select("id, title").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.full_name ?? "Utilisateur"]));
  const titleById = new Map((listingsData ?? []).map((l) => [l.id, l.title]));

  return data.map((row) => {
    const isListing = row.listing_id != null;
    return {
      id: row.id,
      targetType: isListing ? "listing" : "user",
      targetId: isListing ? row.listing_id! : row.reported_user_id!,
      targetLabel: isListing ? titleById.get(row.listing_id!) ?? "Annonce" : nameById.get(row.reported_user_id!) ?? "Utilisateur",
      reporterName: nameById.get(row.reporter_id) ?? "Utilisateur",
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
    };
  });
}

/** Marque un signalement comme traité, sans action supplémentaire sur la cible. */
export async function markReportHandled(reportId: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.from("reports").update({ status: "traite" }).eq("id", reportId);
  if (error) return { error: error.message };
  return { success: true };
}

/** Marque un signalement comme non fondé. */
export async function dismissReport(reportId: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.from("reports").update({ status: "rejete" }).eq("id", reportId);
  if (error) return { error: error.message };
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
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase.from("reports").update({ status: "traite" }).eq("id", reportId);
  if (e2) return { error: e2.message };

  return { success: true };
}
