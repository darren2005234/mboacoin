import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";

/** Ajoute ou retire une annonce des favoris. Retourne le nouvel état. */
export async function toggleFavorite(
  listingId: string
): Promise<{ favorited?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  // Est-ce déjà en favori ?
  const { data: existing } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    // Retirer
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (error) return { error: error.message };
    return { favorited: false };
  } else {
    // Ajouter
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, listing_id: listingId });
    if (error) return { error: error.message };
    return { favorited: true };
  }
}

/** Récupère les ids d'annonces mises en favori par l'utilisateur courant. */
export async function getMyFavoriteIds(): Promise<Set<string>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((f) => f.listing_id));
}

/** Compte le nombre de favoris d'une annonce (le "like"). */
export async function countFavorites(listingId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("listing_id", listingId);
  return count ?? 0;
}

/** Récupère les annonces mises en favori par l'utilisateur courant. */
export async function getMyFavorites(
  sort: "recent" | "price_asc" | "price_desc" = "recent"
): Promise<(Listing & { available: boolean })[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select(
      "created_at, listing:listings(id, title, city, neighborhood, price, bedrooms, image_url, status, property_verified)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  const results = (data ?? [])
    .map((row) => {
      const l = Array.isArray(row.listing) ? row.listing[0] : row.listing;
      if (!l) return null;
      return {
        id: l.id,
        title: l.title,
        location: [l.neighborhood, l.city].filter(Boolean).join(", "),
        price: l.price,
        priceSuffix: "/ mois",
        image: l.image_url ?? "/img/listings/demo-1.jpg",
        bedrooms: l.bedrooms ?? undefined,
        verified: l.property_verified ?? false,
        available: l.status === "publiee",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Tri par prix côté JavaScript (fiable), la date étant déjà gérée par la requête
  if (sort === "price_asc") {
    results.sort((a, b) => a.price - b.price);
  } else if (sort === "price_desc") {
    results.sort((a, b) => b.price - a.price);
  }
  // "recent" : on garde l'ordre de la requête (created_at desc)

  return results;
}