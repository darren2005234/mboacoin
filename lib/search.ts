import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";
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