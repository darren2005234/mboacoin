import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

/**
 * Motifs codés pour un signalement de COMPTE (contrainte reports_user_reason_check
 * côté base). Volontairement pas de motif "paiement hors plateforme" : aucun
 * paiement ne transite par l'app en v1, payer hors plateforme est donc le
 * fonctionnement normal — le vrai problème (paiement anticipé frauduleux
 * avant tout engagement réel) est couvert par "arnaque".
 */
export const REPORT_USER_REASONS = [
  { value: "arnaque", label: "Tentative d'arnaque ou demande de paiement suspecte" },
  { value: "usurpation", label: "Usurpation d'identité" },
  { value: "harcelement", label: "Harcèlement" },
  { value: "comportement_inapproprie", label: "Comportement inapproprié" },
  { value: "autre", label: "Autre" },
] as const;

export const REPORT_USER_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_USER_REASONS.map((r) => [r.value, r.label])
);

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