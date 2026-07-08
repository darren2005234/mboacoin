import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";

function mapRow(row: {
  id: string;
  title: string;
  city: string | null;
  neighborhood: string | null;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  area: number | null;
  image_url: string | null;
  property_verified: boolean | null;
}): Listing {
  return {
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city].filter(Boolean).join(", "),
    price: row.price,
    priceSuffix: "/ mois",
    image: row.image_url ?? "/img/listings/demo-1.jpg",
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    rooms: row.rooms ?? undefined,
    area: row.area ?? undefined,
    verified: row.property_verified ?? false,
  };
}

const SELECT =
  "id, title, city, neighborhood, price, bedrooms, bathrooms, rooms, area, image_url, property_verified";

/** Annonces au logement vérifié (mise en avant de la confiance). */
export async function getVerifiedListings(limit = 10): Promise<Listing[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("status", "publiee")
    .eq("property_verified", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRow);
}

/** Annonces récemment ajoutées. */
export async function getRecentListings(limit = 10): Promise<Listing[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("status", "publiee")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRow);
}

/** Annonces dans une ville donnée. */
export async function getListingsByCity(city: string, limit = 10): Promise<Listing[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("status", "publiee")
    .ilike("city", `%${city}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRow);
}