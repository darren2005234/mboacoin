import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";

export interface PendingListingVerif {
  id: string;
  listingId: string;
  ownerId: string;
  listingTitle: string;
  ownerName: string;
  videoUrl: string;
  createdAt: string;
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
    // URL signée temporaire pour visionner la vidéo privée (1h)
    const { data: signed } = await supabase.storage
      .from("property-videos")
      .createSignedUrl(row.video_path, 3600);

    results.push({
      id: row.id,
      listingId: row.listing_id,
      ownerId: row.owner_id,
      listingTitle: listing?.title ?? "Annonce",
      ownerName: profile?.full_name ?? "Bailleur",
      videoUrl: signed?.signedUrl ?? "",
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
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("listings")
    .update({ property_verified: true })
    .eq("id", listingId);
  if (e2) return { error: e2.message };

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
  if (error) return { error: error.message };
  return { success: true };
}