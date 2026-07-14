import { createClient } from "@/lib/supabase/client";

export interface LeaseRenewalIntent {
  intent: "reste" | "part";
  /** Cycle de couverture concerné (end_date du bail au moment de la réponse). */
  coverageEndDate: string;
  respondedAt: string;
  updatedAt: string;
}

function mapRow(row: {
  intent: string;
  coverage_end_date: string;
  responded_at: string;
  updated_at: string;
}): LeaseRenewalIntent {
  return {
    intent: row.intent as "reste" | "part",
    coverageEndDate: row.coverage_end_date,
    respondedAt: row.responded_at,
    updatedAt: row.updated_at,
  };
}

/** Intention de renouvellement du locataire connecté pour un bail (mode avance), ou null si sans réponse. */
export async function getMyRenewalIntent(leaseId: string): Promise<LeaseRenewalIntent | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lease_renewal_intents")
    .select("intent, coverage_end_date, responded_at, updated_at")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Enregistre ou modifie l'intention du locataire connecté pour la période
 * payée en cours (reste/part). Rejetée côté serveur (set_lease_renewal_intent)
 * si le bail n'est pas actif en mode avance, ou si la couverture est déjà
 * échue — "changer d'avis" n'est possible que tant que la période court.
 */
export async function setMyRenewalIntent(leaseId: string, intent: "reste" | "part"): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_lease_renewal_intent", { p_lease_id: leaseId, p_intent: intent });
  if (error) return { error: error.message || "Impossible d'enregistrer votre réponse." };
  return {};
}

/**
 * Réponse valable pour le cycle de couverture ACTUEL d'un bail (endDate en
 * cours), ou null si sans réponse pour ce cycle — que ce soit parce
 * qu'aucune ligne n'existe, ou que la ligne trouvée date d'un cycle de
 * couverture dépassé (un nouveau versement a prolongé endDate depuis).
 * Source unique de cette lecture : partagée par la synthèse par résidence et
 * l'affichage par bail, pour ne jamais diverger sur "à qui la réponse
 * s'applique-t-elle encore".
 */
export function currentRenewalIntent(
  endDate: string | null,
  intent: LeaseRenewalIntent | undefined
): "reste" | "part" | null {
  if (!endDate || !intent || intent.coverageEndDate !== endDate) return null;
  return intent.intent;
}

/**
 * Intentions de renouvellement pour une liste de baux (bailleur/gestionnaire),
 * en une seule requête. Ne garde que la réponse la plus récente par bail : un
 * bail peut avoir plusieurs lignes historiques (un cycle de couverture par
 * versement d'avance) — c'est à l'appelant de vérifier que coverageEndDate
 * correspond bien au end_date ACTUEL du bail avant de la traiter comme "la"
 * réponse en cours (voir lib/residence-lease-summary.ts), une réponse à un
 * cycle dépassé ne comptant plus pour la période actuelle.
 */
export async function getRenewalIntentsForLeases(
  leaseIds: string[]
): Promise<Record<string, LeaseRenewalIntent>> {
  const result: Record<string, LeaseRenewalIntent> = {};
  if (leaseIds.length === 0) return result;

  const supabase = createClient();
  const { data } = await supabase
    .from("lease_renewal_intents")
    .select("lease_id, intent, coverage_end_date, responded_at, updated_at")
    .in("lease_id", leaseIds);

  for (const row of data ?? []) {
    const existing = result[row.lease_id];
    if (!existing || row.coverage_end_date > existing.coverageEndDate) {
      result[row.lease_id] = mapRow(row);
    }
  }
  return result;
}
