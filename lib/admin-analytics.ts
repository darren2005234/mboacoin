import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";

export interface RecentSearchEvent {
  id: string;
  keywords: string | null;
  propertyType: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minRooms: number | null;
  minBedrooms: number | null;
  furnishing: string | null;
  carAccess: boolean | null;
  verifiedOnly: boolean | null;
  resultsCount: number;
  createdAt: string;
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

/** Recherches récentes, brutes (admin uniquement). */
export async function getRecentSearches(limit = 50): Promise<RecentSearchEvent[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("search_events")
    .select(SEARCH_EVENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapSearchEventRow);
}

/** Recherches n'ayant retourné aucun résultat — la demande non satisfaite. */
export async function getZeroResultSearches(limit = 50): Promise<RecentSearchEvent[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("search_events")
    .select(SEARCH_EVENT_SELECT)
    .eq("results_count", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapSearchEventRow);
}

export interface TopSearchTerm {
  term: string;
  count: number;
}

export interface TopSearchTermsResult {
  terms: TopSearchTerm[];
  sampleSize: number;
}

const RECENT_WINDOW = 1000; // fenêtre bornée pour les agrégations côté JS

/** Top mots-clés recherchés (normalisés), sur une fenêtre récente. */
export async function getTopSearchTerms(limit = 10): Promise<TopSearchTermsResult> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { terms: [], sampleSize: 0 };

  const supabase = createClient();
  const { data } = await supabase
    .from("search_events")
    .select("keywords")
    .not("keywords", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const rows = data ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = (row.keywords ?? "").trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const terms = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { terms, sampleSize: rows.length };
}

export interface BudgetBucket {
  label: string;
  count: number;
}

export interface BudgetDistributionResult {
  buckets: BudgetBucket[];
  sampleSize: number;
}

const BUDGET_BUCKETS: { label: string; max: number }[] = [
  { label: "< 50 000 FCFA", max: 50_000 },
  { label: "50 000 – 100 000 FCFA", max: 100_000 },
  { label: "100 000 – 150 000 FCFA", max: 150_000 },
  { label: "150 000 – 250 000 FCFA", max: 250_000 },
  { label: "250 000 – 500 000 FCFA", max: 500_000 },
  { label: "500 000 FCFA et plus", max: Infinity },
];

/** Répartition des budgets recherchés (min_price/max_price), sur une fenêtre récente. */
export async function getBudgetDistribution(): Promise<BudgetDistributionResult> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { buckets: [], sampleSize: 0 };

  const supabase = createClient();
  const { data } = await supabase
    .from("search_events")
    .select("min_price, max_price")
    .or("min_price.not.is.null,max_price.not.is.null")
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const rows = data ?? [];
  const buckets = BUDGET_BUCKETS.map((b) => ({ label: b.label, count: 0 }));

  for (const row of rows) {
    const value = row.max_price ?? row.min_price;
    if (value == null) continue;
    const idx = BUDGET_BUCKETS.findIndex((b) => value < b.max);
    const bucket = buckets[idx === -1 ? buckets.length - 1 : idx];
    bucket.count++;
  }

  return { buckets, sampleSize: rows.length };
}

export interface ListingStat {
  id: string;
  title: string;
  location: string;
  count: number;
}

/** Annonces les plus consultées (compteur brut, connectés + anonymes). */
export async function getMostViewedListings(limit = 10): Promise<ListingStat[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, view_count")
    .order("view_count", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city].filter(Boolean).join(", "),
    count: row.view_count ?? 0,
  }));
}

/** Annonces les plus mises en favori, sur une fenêtre récente. */
export async function getMostFavoritedListings(limit = 10): Promise<ListingStat[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data: favData } = await supabase
    .from("favorites")
    .select("listing_id")
    .order("created_at", { ascending: false })
    .limit(RECENT_WINDOW);

  const rows = favData ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1);
  }

  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const { data: listingsData } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood")
    .in("id", topIds);

  const byId = new Map((listingsData ?? []).map((l) => [l.id, l]));

  return topIds
    .map((id) => {
      const l = byId.get(id);
      if (!l) return null;
      return {
        id: l.id,
        title: l.title,
        location: [l.neighborhood, l.city].filter(Boolean).join(", "),
        count: counts.get(id) ?? 0,
      };
    })
    .filter((x): x is ListingStat => x !== null);
}
