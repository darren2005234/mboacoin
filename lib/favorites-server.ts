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