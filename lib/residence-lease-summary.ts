import type { Residence } from "@/lib/residences";
import type { MyLease } from "@/lib/leases";
import type { MyListing } from "@/lib/my-listings";
import type { LeaseScheduleStatus } from "@/lib/lease-payments";
import type { LeaseRenewalIntent } from "@/lib/lease-renewal-intent";
import { currentRenewalIntent } from "@/lib/lease-renewal-intent";
import { daysUntil, COVERAGE_ENDING_SOON_DAYS } from "@/lib/lease-schedule";

export const ISOLATED_RESIDENCE_LABEL = "Logements isolés";

export interface ResidenceLeaseSummary {
  /** null = logements sans résidence ("isolés"). */
  residenceId: string | null;
  name: string;
  totalLogements: number;
  /** Annonce avec bail actif (listing.status === 'louee'). */
  loues: number;
  /** Annonce publiée, sans bail actif — vraiment disponible à la location. */
  disponibles: number;
  /** Brouillon ou suspendue — pas louable en l'état, à distinguer d'un logement "disponible". */
  horsMarche: number;
  enAttente: number;
  enRetard: number;
  /** Baux actifs en mode avance dont la couverture s'achève dans COVERAGE_ENDING_SOON_DAYS, par intention du locataire. */
  bientotEchueReste: number;
  bientotEchuePart: number;
  bientotEchueSansReponse: number;
}

/**
 * Associe chaque logement à sa résidence ACTUELLE (pas celle capturée sur le
 * bail à sa création : un logement peut être rattaché à une résidence après
 * la signature d'un bail, et le tableau de bord doit refléter l'état présent,
 * pas un instantané figé).
 */
export function buildResidenceIdByListing(listings: MyListing[]): Map<string, string | null> {
  return new Map(listings.map((l) => [l.id, l.residenceId ?? null]));
}

function emptySummary(residenceId: string | null, name: string): ResidenceLeaseSummary {
  return {
    residenceId,
    name,
    totalLogements: 0,
    loues: 0,
    disponibles: 0,
    horsMarche: 0,
    enAttente: 0,
    enRetard: 0,
    bientotEchueReste: 0,
    bientotEchuePart: 0,
    bientotEchueSansReponse: 0,
  };
}

/**
 * Synthèse par résidence pour le pilotage d'un compte gestionnaire — une
 * entrée par résidence (toujours, même à 0 logement : une résidence vide est
 * une anomalie à montrer, pas à cacher) + une entrée finale pour les
 * logements sans résidence, seulement si elle contient quelque chose.
 *
 * Ne recalcule aucune règle métier : le statut loyer (en retard / à jour)
 * vient de getLeasesScheduleStatus (lib/lease-payments.ts), le seuil
 * "bientôt échue" de COVERAGE_ENDING_SOON_DAYS et l'intention de
 * renouvellement de currentRenewalIntent (lib/lease-renewal-intent.ts) — les
 * mêmes fonctions/constantes que le reste de l'espace bailleur/locataire,
 * pour ne jamais diverger.
 */
export function summarizeLeasesByResidence(
  residences: Residence[],
  listings: MyListing[],
  leases: MyLease[],
  scheduleStatus: Record<string, LeaseScheduleStatus>,
  renewalIntents: Record<string, LeaseRenewalIntent>
): ResidenceLeaseSummary[] {
  const residenceIdByListing = buildResidenceIdByListing(listings);
  const byId = new Map<string | null, ResidenceLeaseSummary>();
  for (const r of residences) byId.set(r.id, emptySummary(r.id, r.name));

  for (const listing of listings) {
    const key = listing.residenceId ?? null;
    const summary = byId.get(key) ?? emptySummary(key, ISOLATED_RESIDENCE_LABEL);
    byId.set(key, summary);
    summary.totalLogements += 1;
    if (listing.status === "louee") summary.loues += 1;
    else if (listing.status === "publiee") summary.disponibles += 1;
    else summary.horsMarche += 1; // brouillon, suspendue, ou tout statut inattendu
  }

  for (const lease of leases) {
    const key = residenceIdByListing.get(lease.listingId) ?? null;
    const summary = byId.get(key) ?? emptySummary(key, ISOLATED_RESIDENCE_LABEL);
    byId.set(key, summary);

    if (lease.status === "en_attente_confirmation") summary.enAttente += 1;
    if (lease.status !== "actif") continue;

    if (lease.paymentMode === "avance") {
      if (lease.endDate && daysUntil(lease.endDate) <= COVERAGE_ENDING_SOON_DAYS) {
        const intent = currentRenewalIntent(lease.endDate, renewalIntents[lease.id]);
        if (intent === "reste") summary.bientotEchueReste += 1;
        else if (intent === "part") summary.bientotEchuePart += 1;
        else summary.bientotEchueSansReponse += 1;
      }
    } else if (scheduleStatus[lease.id]?.late) {
      summary.enRetard += 1;
    }
  }

  const result = residences.map((r) => byId.get(r.id)!);
  const isolated = byId.get(null);
  if (isolated) result.push(isolated);
  return result;
}
