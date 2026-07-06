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
export async function getMyFavorites(): Promise<Listing[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select(
      "listing:listings(id, title, city, neighborhood, price, bedrooms, image_url, status, owner:profiles!listings_owner_id_fkey(verification))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const l = Array.isArray(row.listing) ? row.listing[0] : row.listing;
      if (!l || l.status !== "publiee") return null; // on n'affiche que les annonces encore en ligne
      const owner = Array.isArray(l.owner) ? l.owner[0] : l.owner;
      return {
        id: l.id,
        title: l.title,
        location: [l.neighborhood, l.city].filter(Boolean).join(", "),
        price: l.price,
        priceSuffix: "/ mois",
        image: l.image_url ?? "/img/listings/demo-1.jpg",
        bedrooms: l.bedrooms ?? undefined,
        verified: owner?.verification === "verifie",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

