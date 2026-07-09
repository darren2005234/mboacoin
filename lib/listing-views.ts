import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";

/** Enregistre qu'une annonce a été consultée (met à jour la date si déjà vue). */
export async function recordListingView(listingId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // pas d'historique si non connecté

  // upsert : insère ou met à jour viewed_at si la ligne existe déjà
  await supabase
    .from("listing_views")
    .upsert(
      { user_id: user.id, listing_id: listingId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,listing_id" }
    );
}

/** Récupère l'historique des annonces consultées (les plus récentes d'abord). */
export async function getMyViewedListings(limit = 30): Promise<(Listing & { available: boolean })[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("listing_views")
    .select(
      "viewed_at, listings!inner(id, title, city, neighborhood, price, bedrooms, bathrooms, rooms, area, image_url, property_verified, status)"
    )
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data
    .map((row) => {
      const l = Array.isArray(row.listings) ? row.listings[0] : row.listings;
      if (!l) return null;
      return {
        id: l.id,
        title: l.title,
        location: [l.neighborhood, l.city].filter(Boolean).join(", "),
        price: l.price,
        priceSuffix: "/ mois",
        image: l.image_url ?? "/img/listings/demo-1.jpg",
        bedrooms: l.bedrooms ?? undefined,
        bathrooms: l.bathrooms ?? undefined,
        rooms: l.rooms ?? undefined,
        area: l.area ?? undefined,
        verified: l.property_verified ?? false,
        available: l.status === "publiee",
      } as Listing & { available: boolean };
    })
    .filter((x): x is Listing & { available: boolean } => x !== null);
}

/** Efface tout l'historique de consultation de l'utilisateur. */
export async function clearMyViewHistory(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("listing_views").delete().eq("user_id", user.id);
}