import { daysUntil, isPeriodWithinLease } from "@/lib/lease-schedule";

export interface FinanceLease {
  id: string;
  rentAmount: number;
  paymentPeriod: string; // 'mensuel' | 'journalier'
  paymentMode: string; // 'mensuel' | 'avance'
  startDate: string;
  endDate: string | null;
  status: string;
}

export interface FinanceSummary {
  expected: number;
  collected: number;
  missing: number;
  advanceActiveCount: number;
  /** Date de couverture la plus proche parmi les baux avance actifs, ou null si aucun. */
  advanceEarliestCoverageEnd: string | null;
}

/**
 * Perçu/attendu/manquant pour une période (YYYY-MM-01), sur les baux ACTIFS
 * en mode mensuel uniquement. Un bail en avance ne contribue JAMAIS à ces
 * trois chiffres — mélanger un gros versement ponctuel avec des loyers
 * mensuels rendrait "perçu ce mois" incompréhensible d'un mois sur l'autre
 * (voir argumentaire du chantier). Il alimente uniquement
 * advanceActiveCount/advanceEarliestCoverageEnd, affichés à part. Un bail
 * journalier n'a pas de notion de mois dû, exclu de la même façon qu'il
 * l'est déjà de generateDueDates (lib/lease-schedule.ts).
 *
 * Une période déjà payée n'est JAMAIS manquante, même après un changement de
 * loyer (amendement) : lease_payments.amount est figé au loyer en vigueur au
 * moment du versement (trigger lease_payments_before_insert, ligne immuable)
 * et ne bouge plus jamais — seul lease.rentAmount change avec un amendement.
 * Recalculer "attendu" avec le loyer ACTUEL sur un mois déjà réglé
 * ressusciterait une dette qui n'existe pas (ex. loyer passé de 40 000 à
 * 50 000 après un versement groupé à 40 000 : le mois déjà payé ne doit
 * jamais afficher 10 000 de manquant). Même principe que "une période payée
 * n'est jamais en retard" (nextUnpaidDueDate). D'où : pour un mois payé,
 * expected reprend le montant RÉELLEMENT perçu (jamais le loyer courant) ;
 * le loyer courant ne sert d'estimation de "attendu" que pour un mois SANS
 * paiement enregistré.
 *
 * `missing` ne peut jamais être négatif par construction : pour un mois payé,
 * expected == collected (le même montant réel) ; pour un mois non payé,
 * collected reste 0. La contrainte UNIQUE(lease_id, period) en base empêche
 * par ailleurs un double paiement du même mois.
 */
export function summarizeLeaseFinances(
  period: string,
  leases: readonly FinanceLease[],
  collectedByLease: ReadonlyMap<string, number>
): FinanceSummary {
  let expected = 0;
  let collected = 0;
  let advanceActiveCount = 0;
  let advanceEarliestCoverageEnd: string | null = null;

  for (const lease of leases) {
    if (lease.status !== "actif") continue;

    if (lease.paymentMode === "avance") {
      advanceActiveCount++;
      if (lease.endDate && (!advanceEarliestCoverageEnd || lease.endDate < advanceEarliestCoverageEnd)) {
        advanceEarliestCoverageEnd = lease.endDate;
      }
      continue;
    }

    if (!isPeriodWithinLease(period, lease)) continue;

    const paidAmount = collectedByLease.get(lease.id);
    if (paidAmount != null) {
      // Réglé : le montant réellement versé fait foi, jamais le loyer courant.
      expected += paidAmount;
      collected += paidAmount;
    } else {
      // Pas encore payé : le loyer courant est la seule estimation disponible.
      expected += lease.rentAmount;
    }
  }

  return { expected, collected, missing: expected - collected, advanceActiveCount, advanceEarliestCoverageEnd };
}

export interface LateLeaseInput extends FinanceLease {
  listingTitle: string;
  tenantName: string | null;
}

export interface LateLeaseEntry {
  leaseId: string;
  listingTitle: string;
  tenantName: string | null;
  /** Montant d'une échéance (lease.rentAmount) — même convention que LeaseListItem,
   * pas un cumul d'arriérés : aucune vue existante n'affiche de cumul, on ne
   * diverge pas en en inventant un ici. */
  amount: number;
  dueDate: string;
  daysLate: number;
}

/**
 * Liste des baux en retard pour la synthèse — aucune nouvelle règle de
 * retard : dérivée telle quelle de getLeasesScheduleStatus
 * (lib/lease-payments.ts), déjà la source de vérité partagée par le reste
 * de l'espace bailleur (liste plate, synthèse par résidence). Un bail en
 * avance n'a jamais late === true (déjà garanti par getLeasesScheduleStatus),
 * donc jamais dans cette liste.
 */
export function buildLateLeaseList(
  leases: readonly LateLeaseInput[],
  scheduleStatus: Readonly<Record<string, { late: boolean; nextDueDate: string | null }>>
): LateLeaseEntry[] {
  return leases
    .filter((l) => l.status === "actif" && scheduleStatus[l.id]?.late && scheduleStatus[l.id]?.nextDueDate)
    .map((l) => {
      const dueDate = scheduleStatus[l.id]!.nextDueDate!;
      return {
        leaseId: l.id,
        listingTitle: l.listingTitle,
        tenantName: l.tenantName,
        amount: l.rentAmount,
        dueDate,
        daysLate: -daysUntil(dueDate),
      };
    })
    .sort((a, b) => b.daysLate - a.daysLate);
}
