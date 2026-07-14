import { createClient } from "@/lib/supabase/client";

export interface DeletionStatus {
  pending: boolean;
  scheduledFor: string | null;
}

/** État de la demande d'effacement de l'utilisateur connecté, s'il y en a une en cours. */
export async function getMyDeletionStatus(): Promise<DeletionStatus> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pending: false, scheduledFor: null };

  const { data } = await supabase
    .from("account_deletion_requests")
    .select("scheduled_for")
    .eq("user_id", user.id)
    .eq("status", "en_attente")
    .maybeSingle();

  if (!data) return { pending: false, scheduledFor: null };
  return { pending: true, scheduledFor: data.scheduled_for };
}

/**
 * Demande l'effacement du compte (délai de rétractation de 7 jours). Refusée
 * côté serveur (request_account_deletion) tant qu'un bail est actif, en
 * attente de confirmation, ou qu'une visite confirmée est à venir — le
 * message d'erreur explique pourquoi et quoi faire.
 */
export async function requestAccountDeletion(): Promise<{ scheduledFor?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error) return { error: error.message || "Impossible de traiter la demande." };
  return { scheduledFor: data as string };
}

/** Annule une demande d'effacement en cours (tant qu'elle n'a pas encore été exécutée). */
export async function cancelAccountDeletion(): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) return { error: error.message || "Impossible d'annuler la demande." };
  return {};
}
