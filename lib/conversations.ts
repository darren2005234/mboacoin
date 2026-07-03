import { createClient } from "@/lib/supabase/client";

/**
 * Ouvre la conversation entre l'utilisateur courant (locataire) et le bailleur
 * d'une annonce. La crée si elle n'existe pas encore. Retourne l'id de conversation.
 */
export async function openConversation(
  listingId: string,
  ownerId: string
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  if (user.id === ownerId) {
    return { error: "Vous ne pouvez pas contacter votre propre annonce." };
  }

  // Existe-t-elle déjà ? (unique sur listing_id + tenant_id)
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("tenant_id", user.id)
    .maybeSingle();

  if (existing) return { id: existing.id };

  // Sinon, on la crée
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: listingId,
      tenant_id: user.id,
      owner_id: ownerId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}