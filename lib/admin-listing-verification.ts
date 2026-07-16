import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";
import { friendlyErrorMessage } from "@/lib/supabase-error";
import { logDocumentAccess } from "@/lib/admin-audit-log";

export interface PendingListingVerif {
  id: string;
  listingId: string;
  ownerId: string;
  listingTitle: string;
  ownerName: string;
  videoUrl: string;
  /** true si la vidéo a été purgée (loi n°2024/017) — jamais le cas pour une demande "en_attente", gardé par précaution. */
  videoPurged: boolean;
  createdAt: string;
}

/** Nombre de demandes de vérification de logement en attente (admin uniquement, comptage léger). */
export async function getPendingListingVerifsCount(): Promise<number> {
  const guard = await requireAdminClient();
  if (!guard.ok) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from("listing_verifications")
    .select("*", { count: "exact", head: true })
    .eq("status", "en_attente");

  return count ?? 0;
}

/** Liste les demandes de vérification de logement en attente (admin). */
export async function getPendingListingVerifs(): Promise<PendingListingVerif[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();

  const { data, error } = await supabase
    .from("listing_verifications")
    .select("id, listing_id, owner_id, video_path, created_at, listings(title), profiles(full_name)")
    .eq("status", "en_attente")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const results: PendingListingVerif[] = [];
  for (const row of data) {
    const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    // Garde de conformité (loi n°2024/017) : une vidéo purgée n'a plus de
    // storage_path — ne jamais appeler createSignedUrl sur un chemin absent.
    let videoUrl = "";
    const videoPurged = !row.video_path;
    if (row.video_path) {
      const { data: signed } = await supabase.storage
        .from("property-videos")
        .createSignedUrl(row.video_path, 3600);
      videoUrl = signed?.signedUrl ?? "";
      await logDocumentAccess("listing_video_accessed", "listing_verification", row.id, row.owner_id, "video");
    }

    results.push({
      id: row.id,
      listingId: row.listing_id,
      ownerId: row.owner_id,
      listingTitle: listing?.title ?? "Annonce",
      ownerName: profile?.full_name ?? "Bailleur",
      videoUrl,
      videoPurged,
      createdAt: row.created_at,
    });
  }
  return results;
}

/** Valide : logement vérifié + demande validée. */
export async function approveListingVerif(verifId: string, listingId: string) {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("listing_verifications")
    .update({ status: "validee", reviewed_at: new Date().toISOString() })
    .eq("id", verifId);
  if (e1) return { error: friendlyErrorMessage(e1, "Impossible de valider cette vidéo. Réessayez.") };

  const { error: e2 } = await supabase
    .from("listings")
    .update({ property_verified: true })
    .eq("id", listingId);
  if (e2) return { error: friendlyErrorMessage(e2, "Impossible de valider cette vidéo. Réessayez.") };

  return { success: true };
}

/** Rejette une demande avec un motif. */
export async function rejectListingVerif(verifId: string, reason: string) {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase
    .from("listing_verifications")
    .update({ status: "rejetee", reviewed_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", verifId);
  if (error) return { error: friendlyErrorMessage(error, "Impossible de rejeter cette vidéo. Réessayez.") };
  return { success: true };
}