import { createClient } from "@/lib/supabase/client";
import { bucketizeBudgets } from "@/lib/budget-buckets";
import type { TopSearchTerm, TopSearchTermsResult, BudgetDistributionResult, RecentSearchEvent } from "@/lib/admin-analytics";

export interface MarketZone {
  city?: string;
  neighborhood?: string;
}

const RECENT_WINDOW = 1000;

/** Vérifie côté client que l'appelant est un compte agence, avant de servir de la donnée de marché. */
async function requireAgenceClient(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  return profile?.account_type === "agence";
}

const SEARCH_EVENT_SELECT =
  "id, keywords, property_type, min_price, max_price, min_rooms, min_bedrooms, furnishing, car_access, verified_only, results_count, created_at";

function mapSearchEventRow(row: {
  id: string;
  keywords: string | null;
  property_type: string | null;
  min_price: number | null;
  max_price: number | null;
  min_rooms: number | null;
  min_bedrooms: number | null;
  furnishing: string | null;
  car_access: boolean | null;
  verified_only: boolean | null;
  results_count: number;
  created_at: string;
}): RecentSearchEvent {
  return {
    id: row.id,
    keywords: row.keywords,
    propertyType: row.property_type,
    minPrice: row.min_price,
    maxPrice: row.max_price,
    minRooms: row.min_rooms,
    minBedrooms: row.min_bedrooms,
    furnishing: row.furnishing,
    carAccess: row.car_access,
    verifiedOnly: row.verified_only,
    resultsCount: row.results_count,
    createdAt: row.created_at,
  };
}

/** Demande par zone : mots-clés les plus recherchés, filtrés sur une zone si fournie. */
export async function getDemandByZone(zone?: MarketZone, limit = 10): Promise<TopSearchTermsResult> {
  if (!(await requireAgenceClient())) return { terms: [], sampleSize: 0 };

  const supabase = createClient();
  let query = supabase
    .from("search_events")
    .select("keywords")
    .not("keywords", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const zoneText = zone?.city || zone?.neighborhood;
  if (zoneText) {
    query = query.ilike("keywords", `%${zoneText}%`);
  }

  const { data } = await query;
  const rows = data ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = (row.keywords ?? "").trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const terms: TopSearchTerm[] = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { terms, sampleSize: rows.length };
}

/** Répartition des budgets recherchés, filtrée sur une zone si fournie (mêmes tranches que l'observatoire admin). */
export async function getMarketBudgetDistribution(zone?: MarketZone): Promise<BudgetDistributionResult> {
  if (!(await requireAgenceClient())) return { buckets: [], sampleSize: 0 };

  const supabase = createClient();
  let query = supabase
    .from("search_events")
    .select("min_price, max_price, keywords")
    .or("min_price.not.is.null,max_price.not.is.null")
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const zoneText = zone?.city || zone?.neighborhood;
  if (zoneText) {
    query = query.ilike("keywords", `%${zoneText}%`);
  }

  const { data } = await query;
  const rows = data ?? [];
  const values = rows.map((row) => row.max_price ?? row.min_price).filter((v): v is number => v != null);

  return { buckets: bucketizeBudgets(values), sampleSize: rows.length };
}

/** Recherches sans résultat (demande non satisfaite), filtrées sur une zone si fournie. Anonyme par construction. */
export async function getMarketZeroResultSearches(zone?: MarketZone, limit = 50): Promise<RecentSearchEvent[]> {
  if (!(await requireAgenceClient())) return [];

  const supabase = createClient();
  let query = supabase
    .from("search_events")
    .select(SEARCH_EVENT_SELECT)
    .eq("results_count", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  const zoneText = zone?.city || zone?.neighborhood;
  if (zoneText) {
    query = query.ilike("keywords", `%${zoneText}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapSearchEventRow);
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

/** Loyer mensuel moyen par ville et type de bien, sur les annonces publiées. Jamais d'id/titre d'annonce. */
export async function getAveragePricesByZone(zone?: MarketZone): Promise<AveragePricesResult> {
  if (!(await requireAgenceClient())) return { groups: [], sampleSize: 0 };

  const supabase = createClient();
  let query = supabase
    .from("listings")
    .select("city, neighborhood, property_type, price")
    .eq("status", "publiee")
    .eq("price_period", "mensuel");

  if (zone?.city) query = query.ilike("city", `%${zone.city}%`);
  if (zone?.neighborhood) query = query.ilike("neighborhood", `%${zone.neighborhood}%`);

  const { data } = await query;
  const rows = data ?? [];

  const groups = new Map<string, { city: string; propertyType: string; sum: number; count: number }>();
  for (const row of rows) {
    const key = `${row.city}::${row.property_type}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sum += row.price;
      existing.count++;
    } else {
      groups.set(key, { city: row.city, propertyType: row.property_type, sum: row.price, count: 1 });
    }
  }

  const result: PriceGroup[] = [...groups.values()]
    .map((g) => ({ city: g.city, propertyType: g.propertyType, avgPrice: Math.round(g.sum / g.count), count: g.count }))
    .sort((a, b) => b.count - a.count);

  return { groups: result, sampleSize: rows.length };
}

export interface MonthlyTrendPoint {
  month: string; // "2026-07"
  searchCount: number;
  zeroResultCount: number;
}

export interface MarketTrendResult {
  points: MonthlyTrendPoint[];
  hasEnoughHistory: boolean;
}

const TREND_MONTHS = 6;

/** Évolution mensuelle des recherches (et des recherches sans résultat), filtrée sur une zone si fournie. */
export async function getSearchTrend(zone?: MarketZone): Promise<MarketTrendResult> {
  if (!(await requireAgenceClient())) return { points: [], hasEnoughHistory: false };

  const supabase = createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - TREND_MONTHS);

  let query = supabase
    .from("search_events")
    .select("created_at, results_count, keywords")
    .gte("created_at", since.toISOString());

  const zoneText = zone?.city || zone?.neighborhood;
  if (zoneText) {
    query = query.ilike("keywords", `%${zoneText}%`);
  }

  const { data } = await query;
  const rows = data ?? [];

  const byMonth = new Map<string, { searchCount: number; zeroResultCount: number }>();
  for (const row of rows) {
    const month = row.created_at.slice(0, 7); // "YYYY-MM"
    const entry = byMonth.get(month) ?? { searchCount: 0, zeroResultCount: 0 };
    entry.searchCount++;
    if (row.results_count === 0) entry.zeroResultCount++;
    byMonth.set(month, entry);
  }

  const points: MonthlyTrendPoint[] = [...byMonth.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { points, hasEnoughHistory: points.length >= 2 };
}
