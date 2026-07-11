export interface BudgetBucket {
  label: string;
  count: number;
}

export const BUDGET_BUCKETS: { label: string; max: number }[] = [
  { label: "< 50 000 FCFA", max: 50_000 },
  { label: "50 000 – 100 000 FCFA", max: 100_000 },
  { label: "100 000 – 150 000 FCFA", max: 150_000 },
  { label: "150 000 – 250 000 FCFA", max: 250_000 },
  { label: "250 000 – 500 000 FCFA", max: 500_000 },
  { label: "500 000 FCFA et plus", max: Infinity },
];

/** Répartit une liste de valeurs de budget dans les tranches fixes ci-dessus. */
export function bucketizeBudgets(values: number[]): BudgetBucket[] {
  const buckets = BUDGET_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const value of values) {
    const idx = BUDGET_BUCKETS.findIndex((b) => value < b.max);
    buckets[idx === -1 ? buckets.length - 1 : idx].count++;
  }
  return buckets;
}
