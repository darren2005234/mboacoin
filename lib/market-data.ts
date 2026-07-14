import { createClient } from "@/lib/supabase/client";
import type { BudgetBucket } from "@/lib/budget-buckets";
import type { TopSearchTerm, TopSearchTermsResult } from "@/lib/admin-analytics";

export interface MarketZone {
  city?: string;
  neighborhood?: string;
}

function zoneText(zone?: MarketZone): string | null {
  return zone?.city || zone?.neighborhood || null;
}

/** Demande par zone : mots-clés les plus recherchés. Agrégé côté serveur (RPC SECURITY DEFINER) : jamais de ligne brute. */
export async function getDemandByZone(zone?: MarketZone, limit = 10): Promise<TopSearchTermsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("agency_market_top_terms", {
    p_zone: zoneText(zone),
    p_limit: limit,
  });
  if (error || !data) return { terms: [], sampleSize: 0 };
  return { terms: (data.terms ?? []) as TopSearchTerm[], sampleSize: data.sampleSize ?? 0 };
}

export interface BudgetDistributionResult {
  buckets: BudgetBucket[];
  sampleSize: number;
}

/**
 * Répartition des budgets recherchés, mêmes tranches que l'observatoire admin. Agrégée côté serveur.
 * `buckets` est vide dès que `sampleSize` est sous le seuil minimum : la distribution n'est alors
 * jamais transmise (à distinguer de `sampleSize === 0`, où il n'y a simplement aucune recherche).
 */
export async function getMarketBudgetDistribution(zone?: MarketZone): Promise<BudgetDistributionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("agency_market_budget_distribution", {
    p_zone: zoneText(zone),
  });
  if (error || !data) return { buckets: [], sampleSize: 0 };
  const buckets = (data.buckets ?? []) as { label: string; count: number }[];
  return { buckets, sampleSize: data.sampleSize ?? 0 };
}

/** Termes les plus recherchés parmi les recherches sans résultat (demande non satisfaite). Agrégé, jamais de ligne brute. */
export async function getMarketUnmetDemand(zone?: MarketZone, limit = 10): Promise<TopSearchTermsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("agency_market_unmet_terms", {
    p_zone: zoneText(zone),
    p_limit: limit,
  });
  if (error || !data) return { terms: [], sampleSize: 0 };
  return { terms: (data.terms ?? []) as TopSearchTerm[], sampleSize: data.sampleSize ?? 0 };
}

export interface PriceGroup {
  city: string;
  propertyType: string;
  avgPrice: number;
  count: number;
}

export interface AveragePricesResult {
  groups: PriceGroup[];
  sampleSize: number;
}

/**
 * Loyer mensuel moyen par ville et type de bien, sur les annonces publiées.
 * Un groupe (ville + type) calculé sur moins de 5 annonces n'est jamais renvoyé par le
 * serveur : sous ce seuil, une "moyenne" est en réalité le prix exact d'un bien identifiable.
 * `sampleSize` reste le volume total d'annonces correspondant au filtre (avant ce filtrage
 * par groupe), pour distinguer "aucune annonce" de "annonces trop dispersées pour agréger".
 */
export async function getAveragePricesByZone(zone?: MarketZone): Promise<AveragePricesResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("agency_market_average_prices", {
    p_city: zone?.city ?? null,
    p_neighborhood: zone?.neighborhood ?? null,
  });
  if (error || !data) return { groups: [], sampleSize: 0 };
  const groups = (data.groups ?? []) as PriceGroup[];
  return { groups, sampleSize: data.totalListings ?? 0 };
}

export interface MonthlyTrendPoint {
  month: string; // "2026-07"
  searchCount: number;
  zeroResultCount: number;
}

export interface MarketTrendResult {
  points: MonthlyTrendPoint[];
  totalSearches: number;
}

/**
 * Évolution mensuelle des recherches (et des recherches sans résultat). Agrégée côté serveur.
 * `points` est vide dès que le volume total sur la période est sous le seuil minimum : à
 * distinguer de `totalSearches === 0` (aucune recherche du tout).
 */
export async function getSearchTrend(zone?: MarketZone, months = 6): Promise<MarketTrendResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("agency_market_trend", {
    p_zone: zoneText(zone),
    p_months: months,
  });
  if (error || !data) return { points: [], totalSearches: 0 };
  const points = (data.points ?? []) as MonthlyTrendPoint[];
  return { points, totalSearches: data.totalSearches ?? 0 };
}
