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
  const clamp = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let candidate = clamp(today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = clamp(today.getFullYear(), today.getMonth() + 1);

  const start = new Date(startDate);
  if (candidate < start) candidate = clamp(start.getFullYear(), start.getMonth() + 1);

  return candidate;
}
