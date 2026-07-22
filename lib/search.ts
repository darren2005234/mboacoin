import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";
import type { ResidenceSearchResult } from "@/components/mboacoin/residence-card-compact";
import { priceSuffixFor } from "@/lib/price-period";


export interface SearchCriteria {
  keywords?: string;
  city?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  minRooms?: number;
  minBedrooms?: number;
  furnishing?: string;
  carAccess?: boolean;
  sort?: "recent" | "price_asc" | "price_desc";
  offset?: number; // à partir de quelle annonce
  limit?: number;  // combien en charger
  verifiedOnly?: boolean;
}

export interface SearchResult {
  listings: Listing[];
  total: number;
}

/** Recherche des annonces selon des critères, avec le nombre total de résultats. */
export async function searchListings(criteria: SearchCriteria): Promise<SearchResult> {
  const supabase = createClient();

  // On construit la requête progressivement
  let query = supabase
    .from("listings")
    .select(
      "id, title, city, neighborhood, price, price_period, bedrooms, bathrooms, rooms, area, image_url, property_verified, residence_id, residence:residences(name)",
      { count: "exact" } // pour obtenir le nombre total
    )
    .eq("status", "publiee"); // règle : seules les annonces actives

  // Recherche par mots-clés (dans le titre ou la description)
  if (criteria.keywords && criteria.keywords.trim()) {
    const kw = criteria.keywords.trim();
    query = query.or(
      `title.ilike.%${kw}%,description.ilike.%${kw}%,city.ilike.%${kw}%,neighborhood.ilike.%${kw}%`
    );
  }

  // Filtre par ville
  if (criteria.city && criteria.city.trim()) {
    query = query.ilike("city", `%${criteria.city.trim()}%`);
  }

  // Filtre par quartier
  if (criteria.neighborhood && criteria.neighborhood.trim()) {
    query = query.ilike("neighborhood", `%${criteria.neighborhood.trim()}%`);
  }

  // Budget
  if (criteria.minPrice != null) {
    query = query.gte("price", criteria.minPrice);
  }
  if (criteria.maxPrice != null) {
    query = query.lte("price", criteria.maxPrice);
  }

  // Type de bien
  if (criteria.propertyType && criteria.propertyType.trim()) {
    query = query.eq("property_type", criteria.propertyType);
  }

  // Nombre minimum de pièces
  if (criteria.minRooms != null) {
    query = query.gte("rooms", criteria.minRooms);
  }

  // Nombre minimum de chambres
  if (criteria.minBedrooms != null) {
    query = query.gte("bedrooms", criteria.minBedrooms);
  }

  // Meublé
  if (criteria.furnishing && criteria.furnishing.trim()) {
    query = query.eq("furnishing", criteria.furnishing);
  }

  // Accès voiture
  if (criteria.carAccess) {
    query = query.eq("car_access", true);
  }

  // Logement vérifié uniquement
  if (criteria.verifiedOnly) {
    query = query.eq("property_verified", true);
  }

  // Pagination (chargement par lots)
  const offset = criteria.offset ?? 0;
  const limit = criteria.limit ?? 15;
  query = query.range(offset, offset + limit - 1);

  // Tri
  if (criteria.sort === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (criteria.sort === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }); // récent par défaut
  }

  const { data, error, count } = await query;

  if (error) {
    return { listings: [], total: 0 };
  }

  const listings: Listing[] = (data ?? []).map((row) => {
    const residence = Array.isArray(row.residence) ? row.residence[0] : row.residence;
    return {
      id: row.id,
      title: row.title,
      location: [row.neighborhood, row.city].filter(Boolean).join(", "),
      price: row.price,
      priceSuffix: priceSuffixFor(row.price_period),
      image: row.image_url ?? "/img/listings/demo-1.jpg",
      bedrooms: row.bedrooms ?? undefined,
      bathrooms: row.bathrooms ?? undefined,
      rooms: row.rooms ?? undefined,
      area: row.area ?? undefined,
      verified: row.property_verified ?? false,
      residenceId: row.residence_id ?? undefined,
      residenceName: residence?.name ?? undefined,
    };
  });

  return { listings, total: count ?? 0 };
}

export interface MapListing {
  id: string;
  title: string;
  price: number;
  priceSuffix: string;
  image: string;
  isExact: boolean;
  latitude: number;
  longitude: number;
  radiusMeters: number | null;
}

/**
 * Annonces géolocalisées correspondant aux mêmes filtres que searchListings,
 * pour la carte de recherche. Passe par get_map_listings (SECURITY DEFINER) :
 * latitude/longitude sont des colonnes révoquées en select direct (voir
 * 20260717170000_listing_geolocation.sql), la fonction applique déjà la
 * règle d'arrondi côté serveur.
 */
export async function getMapListings(
  criteria: Pick<SearchCriteria, "city" | "neighborhood" | "minPrice" | "maxPrice" | "propertyType">
): Promise<MapListing[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_map_listings", {
    p_city: criteria.city?.trim() || null,
    p_neighborhood: criteria.neighborhood?.trim() || null,
    p_min_price: criteria.minPrice ?? null,
    p_max_price: criteria.maxPrice ?? null,
    p_property_type: criteria.propertyType?.trim() || null,
  });

  if (error || !data) return [];

  return (data as {
    id: string; title: string; price: number; price_period: string; image_url: string | null;
    is_exact: boolean; latitude: number; longitude: number; radius_meters: number | null;
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    priceSuffix: priceSuffixFor(row.price_period),
    image: row.image_url ?? "/img/listings/demo-1.jpg",
    isExact: row.is_exact,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
  }));
}

export interface ResidenceSearchCriteria {
  keywords?: string;
  offset?: number;
  limit?: number;
}

export interface ResidenceSearchOutput {
  residences: ResidenceSearchResult[];
  total: number;
}

/** Recherche des résidences par mot-clé (nom, ville, quartier, description). */
export async function searchResidences(criteria: ResidenceSearchCriteria): Promise<ResidenceSearchOutput> {
  const supabase = createClient();
  let query = supabase
    .from("residences")
    .select("id, name, city, neighborhood, image_url, manager_id", { count: "exact" });

  if (criteria.keywords && criteria.keywords.trim()) {
    const kw = criteria.keywords.trim();
    query = query.or(`name.ilike.%${kw}%,city.ilike.%${kw}%,neighborhood.ilike.%${kw}%,description.ilike.%${kw}%`);
  }

  const offset = criteria.offset ?? 0;
  const limit = criteria.limit ?? 15;
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error || !data) return { residences: [], total: 0 };

  const managerIds = [...new Set(data.map((r) => r.manager_id))];
  const { data: managers } = await supabase.from("profiles").select("id, verification").in("id", managerIds);
  const verifiedIds = new Set((managers ?? []).filter((m) => m.verification === "verifie").map((m) => m.id));

  const counts = await Promise.all(
    data.map((r) =>
      supabase.from("listings").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "publiee")
    )
  );

  return {
    residences: data.map((r, i) => ({
      id: r.id,
      name: r.name,
      location: [r.neighborhood, r.city].filter(Boolean).join(", "),
      imageUrl: r.image_url,
      managerVerified: verifiedIds.has(r.manager_id),
      availableCount: counts[i].count ?? 0,
    })),
    total: count ?? 0,
  };
}