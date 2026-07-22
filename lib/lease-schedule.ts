/**
 * Fenêtre "couverture bientôt échue" (mode avance), partagée par les badges
 * de l'espace bailleur (liste des baux, détail d'un bail), /my-leases/coverage
 * et la synthèse par résidence. Volontairement plus large que le rappel
 * locataire (J-30, voir supabase/functions/rent-reminders) : un gestionnaire
 * doit pouvoir relouer avant l'échéance, pas seulement être notifié en même
 * temps que son locataire — sinon il n'a aucune avance pour réagir.
 */
export const COVERAGE_ENDING_SOON_DAYS = 60;

function clampToMonth(day: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** Date du jour en ISO, en heure LOCALE (pas toISOString, qui convertit en
 * UTC et peut renvoyer la veille pour un fuseau positif en début de nuit). */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Génère l'identité de chaque échéance mensuelle (premier jour du mois, ISO
 * YYYY-MM-DD) d'un bail, du début du bail jusqu'à `until` inclus. Renvoie []
 * pour un bail journalier (pas de planning à échéances fixes pour ce cas —
 * voir lib/lease-payments.ts). Ne dépend pas de paymentDay : l'identité
 * d'une échéance est le mois qu'elle couvre, pas sa date d'exigibilité (voir
 * dueDateForPeriod) — sinon changer le jour de paiement décale les échéances
 * déjà stockées dans lease_payments et casse leur correspondance.
 *
 * Les chaînes ISO sont construites par arithmétique entière pure (pas de
 * Date + toISOString) : lease_payments.period est une colonne `date` sans
 * fuseau côté Postgres, alors que `new Date(y, m, 1).toISOString()` convertit
 * une date LOCALE en UTC — pour un fuseau positif (ex. UTC+1), ça fait
 * reculer la date d'un jour ("2026-02-01" local devient "2026-01-31" en
 * UTC), et plus aucune échéance ne correspond aux paiements enregistrés.
 */
export function generateDueDates(
  startDate: string,
  paymentPeriod: string,
  until: Date = new Date()
): string[] {
  if (paymentPeriod === "journalier") return [];

  let year = Number(startDate.slice(0, 4));
  let month = Number(startDate.slice(5, 7)); // 1-indexé

  const limitYear = until.getFullYear();
  const limitMonth = until.getMonth() + 1; // 1-indexé

  const dates: string[] = [];
  while (year < limitYear || (year === limitYear && month <= limitMonth)) {
    dates.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return dates;
}

/**
 * Date d'échéance affichée pour une période (mois) donnée, selon le jour de
 * paiement actuel du bail (repli sur le jour de début de bail si absent).
 * Peut légitimement changer si payment_day change ; ne sert jamais de clé de
 * correspondance avec lease_payments.period, seulement à l'affichage et au
 * calcul de retard. `clampToMonth` construit et lit sa Date en heure locale
 * sans jamais passer par toISOString, donc pas de décalage de fuseau ici.
 */
export function dueDateForPeriod(period: string, paymentDay: number | null, startDate: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1; // 0-indexé pour clampToMonth
  const day = paymentDay ?? Number(startDate.slice(8, 10));
  const clamped = clampToMonth(day, year, month);
  const y = clamped.getFullYear();
  const m = String(clamped.getMonth() + 1).padStart(2, "0");
  const d = String(clamped.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Date d'échéance de la PREMIÈRE période sans paiement enregistré, en
 * parcourant les mois dans l'ordre depuis le début du bail et en croisant
 * chacun avec `paidPeriods` (l'intégralité des paiements du bail, jamais
 * seulement le dernier, ni la période courante, ni la date du jour). Un
 * versement groupé peut avoir couvert des mois futurs : cette fonction ne
 * s'arrête donc jamais à "aujourd'hui" comme le ferait generateDueDates,
 * elle continue jusqu'au premier vrai trou, même au-delà de la couverture
 * déjà payée. Règle : une période avec un paiement enregistré n'est jamais
 * due ni en retard, quelle que soit la date effective du versement.
 *
 * Fonction pure (aucune dépendance Supabase), importable depuis un
 * composant serveur ou client. Renvoie null pour un bail journalier (pas
 * d'échéance fixe) ou si les 100 prochaines années sont déjà couvertes
 * (garde-fou, ne devrait jamais se produire en pratique).
 */
export function nextUnpaidDueDate(
  startDate: string,
  paymentDay: number | null,
  paymentPeriod: string,
  paidPeriods: ReadonlySet<string>
): string | null {
  if (paymentPeriod === "journalier") return null;

  let year = Number(startDate.slice(0, 4));
  let month = Number(startDate.slice(5, 7)); // 1-indexé

  for (let i = 0; i < 1200; i++) {
    const period = `${year}-${String(month).padStart(2, "0")}-01`;
    if (!paidPeriods.has(period)) {
      return dueDateForPeriod(period, paymentDay, startDate);
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return null;
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif si passée). */
export function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Le mois `period` (YYYY-MM-01) fait-il partie de l'échéancier mensuel de ce
 * bail ? Répond à une question qu'aucune fonction ci-dessus ne pose
 * directement (generateDueDates énumère, nextUnpaidDueDate cherche le
 * premier trou) — utilisé par la synthèse financière du bailleur
 * (lib/lease-finance-summary.ts) pour savoir si un bail doit contribuer au
 * "attendu" d'un mois donné, sans recalculer l'échéancier lui-même.
 * Comparaison de chaînes YYYY-MM (ordre lexicographique = chronologique),
 * jamais Date/toISOString (voir la mise en garde en tête de fichier).
 */
export function isPeriodWithinLease(
  period: string,
  lease: { startDate: string; paymentPeriod: string; endDate: string | null }
): boolean {
  if (lease.paymentPeriod === "journalier") return false;
  const month = period.slice(0, 7);
  if (month < lease.startDate.slice(0, 7)) return false;
  if (lease.endDate && month > lease.endDate.slice(0, 7)) return false;
  return true;
}

/** Période (YYYY-MM-01) du mois en cours ou précédent, en heure locale. */
export function monthPeriod(offsetMonths: 0 | -1 = 0): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offsetMonths; // 0-indexé ; -1 = mois précédent
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
