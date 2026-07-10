/** Périodicité de tarification d'une annonce, source unique de vérité pour l'UI. */
export const PRICE_PERIODS = ["mensuel", "journalier"] as const;

export const PRICE_PERIOD_LABELS: Record<string, string> = {
  mensuel: "Par mois",
  journalier: "Par jour",
};

const PRICE_SUFFIXES: Record<string, string> = {
  mensuel: "/ mois",
  journalier: "/ jour",
};

/** Suffixe d'affichage du prix selon la période ("/ mois" par défaut, y compris si null/undefined). */
export function priceSuffixFor(period: string | null | undefined): string {
  return PRICE_SUFFIXES[period ?? "mensuel"] ?? PRICE_SUFFIXES.mensuel;
}
