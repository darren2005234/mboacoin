import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

/** Signale une annonce. */
export async function reportListing(
  listingId: string,
  reason: string,
  details: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    listing_id: listingId,
    reason,
    details: details.trim() || null,
  });

  if (error) {
    // Code 23505 = violation de contrainte d'unicité (déjà signalé)
    if (error.code === "23505") {
      return { error: "Vous avez déjà signalé cette annonce." };
    }
    return { error: friendlyErrorMessage(error, "Impossible d'envoyer ce signalement. Réessayez.") };
  }
  return { success: true };
}

/** Signale un utilisateur (bailleur). */
export async function reportUser(
  userId: string,
  reason: string,
  details: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: userId,
    reason,
    details: details.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Vous avez déjà signalé cet utilisateur." };
    }
    return { error: friendlyErrorMessage(error, "Impossible d'envoyer ce signalement. Réessayez.") };
  }
  return { success: true };
}