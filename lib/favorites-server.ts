import { createClient } from "@/lib/supabase/server";

/** Récupère les ids d'annonces mises en favori par l'utilisateur connecté (côté serveur). */
export async function getMyFavoriteIdsServer(): Promise<Set<string>> {
  const supabase = await createClient();
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

/** Compte le nombre de favoris d'une annonce (côté serveur). */
export async function countFavoritesServer(listingId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("listing_id", listingId);
  return count ?? 0;
}