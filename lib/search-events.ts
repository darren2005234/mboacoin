import { createClient } from "@/lib/supabase/client";
import type { Filters } from "@/components/mboacoin/filters-sheet";

/** Enregistre une recherche stabilisée (mots-clés + filtres + nombre de résultats). Échec silencieux. */
export async function logSearchEvent(keywords: string, filters: Filters, resultsCount: number): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("search_events").insert({
      user_id: user?.id ?? null,
      keywords: keywords.trim() || null,
      min_price: filters.minPrice ? Number(filters.minPrice) : null,
      max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
      property_type: filters.propertyType || null,
      min_rooms: filters.minRooms ? Number(filters.minRooms) : null,
      min_bedrooms: filters.minBedrooms ? Number(filters.minBedrooms) : null,
      furnishing: filters.furnishing || null,
      car_access: filters.carAccess,
      verified_only: filters.verifiedOnly,
      results_count: resultsCount,
    });
  } catch {
    // collecte non bloquante : un échec ne doit jamais perturber la recherche
  }
}
