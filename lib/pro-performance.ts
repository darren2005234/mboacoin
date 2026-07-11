import { createClient } from "@/lib/supabase/client";

export interface ListingPerformance {
  id: string;
  title: string;
  location: string;
  residenceId: string | null;
  residenceName: string | null;
  viewCount: number;
  favoriteCount: number;
  conversationCount: number;
}

export interface PerformanceSummary {
  listings: ListingPerformance[];
  totals: { views: number; favorites: number; conversations: number };
}

/** Performances des annonces de l'utilisateur connecté (vues, favoris, conversations). */
export async function getMyListingsPerformance(): Promise<PerformanceSummary> {
  const empty: PerformanceSummary = { listings: [], totals: { views: 0, favorites: 0, conversations: 0 } };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: listingsData, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, view_count, residence_id, residence:residences(name)")
    .eq("owner_id", user.id);

  if (error || !listingsData || listingsData.length === 0) return empty;

  const ids = listingsData.map((l) => l.id);

  const [{ data: favData }, { data: convData }] = await Promise.all([
    supabase.from("favorites").select("listing_id").in("listing_id", ids),
    supabase.from("conversations").select("listing_id").eq("owner_id", user.id),
  ]);

  const favoriteCounts = new Map<string, number>();
  for (const row of favData ?? []) {
    favoriteCounts.set(row.listing_id, (favoriteCounts.get(row.listing_id) ?? 0) + 1);
  }

  const conversationCounts = new Map<string, number>();
  for (const row of convData ?? []) {
    conversationCounts.set(row.listing_id, (conversationCounts.get(row.listing_id) ?? 0) + 1);
  }

  const listings: ListingPerformance[] = listingsData.map((row) => {
    const residence = Array.isArray(row.residence) ? row.residence[0] : row.residence;
    return {
      id: row.id,
      title: row.title,
      location: [row.neighborhood, row.city].filter(Boolean).join(", "),
      residenceId: row.residence_id ?? null,
      residenceName: residence?.name ?? null,
      viewCount: row.view_count ?? 0,
      favoriteCount: favoriteCounts.get(row.id) ?? 0,
      conversationCount: conversationCounts.get(row.id) ?? 0,
    };
  });

  const totals = listings.reduce(
    (acc, l) => ({
      views: acc.views + l.viewCount,
      favorites: acc.favorites + l.favoriteCount,
      conversations: acc.conversations + l.conversationCount,
    }),
    { views: 0, favorites: 0, conversations: 0 }
  );

  return { listings, totals };
}
