function clampToMonth(day: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * Calcule la prochaine échéance de paiement d'un bail à partir du jour de
 * paiement et de la périodicité. Fonction pure (aucune dépendance Supabase),
 * importable depuis un composant serveur ou client.
 */
export function nextPaymentDueDate(
  startDate: string,
  paymentDay: number | null,
  paymentPeriod: string
): Date | null {
  if (paymentPeriod === "journalier") return null;

  const day = paymentDay ?? new Date(startDate).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let candidate = clampToMonth(day, today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = clampToMonth(day, today.getFullYear(), today.getMonth() + 1);

  const start = new Date(startDate);
  if (candidate < start) candidate = clampToMonth(day, start.getFullYear(), start.getMonth() + 1);

  return candidate;
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

/** Nombre de jours entre aujourd'hui et une date ISO (négatif si passée). */
export function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
