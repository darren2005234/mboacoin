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
 * Génère toutes les échéances (dates ISO YYYY-MM-DD) d'un bail mensuel, du
 * début du bail jusqu'à `until` inclus. Renvoie [] pour un bail journalier
 * (pas de planning à échéances fixes pour ce cas — voir lib/lease-payments.ts).
 * Renvoie des chaînes ISO plutôt que des Date pour se comparer directement
 * aux colonnes `date` de Postgres sans risque de décalage de fuseau.
 */
export function generateDueDates(
  startDate: string,
  paymentDay: number | null,
  paymentPeriod: string,
  until: Date = new Date()
): string[] {
  if (paymentPeriod === "journalier") return [];

  const day = paymentDay ?? new Date(startDate).getDate();
  const start = new Date(startDate);
  const limit = new Date(until);
  limit.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  let cursor = clampToMonth(day, start.getFullYear(), start.getMonth());
  if (cursor < start) cursor = clampToMonth(day, start.getFullYear(), start.getMonth() + 1);

  while (cursor <= limit) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = clampToMonth(day, cursor.getFullYear(), cursor.getMonth() + 1);
  }
  return dates;
}
