import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/components/mboacoin/listing-card";
import { priceSuffixFor } from "@/lib/price-period";


/** Récupère les annonces publiées, les plus récentes d'abord. */
export async function getPublishedListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, city, neighborhood, price, price_period, bedrooms, image_url, status, owner:profiles!listings_owner_id_fkey(full_name, verification), bathrooms, rooms, area, property_verified, residence_id, residence:residences(name)"
    )
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur lecture annonces:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
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
}

/** Récupère une annonce publiée par son id, ou null si introuvable. */
export async function getListingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, description, city, neighborhood, price, bedrooms, bathrooms, rooms, area, available_from, reference, advance_months, deposit_months, furnishing, water, electricity, amenities, image_url, status, owner_id, owner:profiles!listings_owner_id_fkey(full_name, verification, avatar_url), media:listing_media(storage_path, position), address_description,property_verified,floor_number, car_access, flood_zone, residence_id, price_period, residence:residences(name, image_url, city, neighborhood)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner;
  const residence = Array.isArray(data.residence) ? data.residence[0] : data.residence;

  const media = (data.media ?? []) as { storage_path: string; position: number }[];
  const images = media
    .sort((a, b) => a.position - b.position)
    .map((m) => supabase.storage.from("listings").getPublicUrl(m.storage_path).data.publicUrl);
  const gallery = images.length > 0 ? images : data.image_url ? [data.image_url] : [];

  return {
    id: data.id,
    title: data.title,
    description: (data.description as string | null) ?? null,
    location: [data.neighborhood, data.city].filter(Boolean).join(", "),
    price: data.price,
    priceSuffix: priceSuffixFor(data.price_period),
    images: gallery,
    bedrooms: data.bedrooms ?? null,
    bathrooms: data.bathrooms ?? null,
    rooms: data.rooms ?? null,
    area: data.area ?? null,
    availableFrom: data.available_from ?? null,
    reference: (data as { reference: string }).reference,
    advanceMonths: data.advance_months ?? null,
    depositMonths: data.deposit_months ?? null,
    furnishing: (data.furnishing as string | null) ?? null,
    water: (data.water as string | null) ?? null,
    electricity: (data.electricity as string | null) ?? null,
    amenities: (data.amenities as string[] | null) ?? [],
    ownerName: owner?.full_name ?? "Bailleur",
    ownerAvatar: owner?.avatar_url ?? null,
    verified: owner?.verification === "verifie",
    ownerId: data.owner_id,
    available: data.status === "publiee",
    addressDescription: (data.address_description as string | null) ?? null,
    propertyVerified: data.property_verified ?? false,
    floorNumber: data.floor_number ?? null,
    carAccess: data.car_access ?? false,
    floodZone: data.flood_zone ?? false,
    residenceId: (data.residence_id as string | null) ?? null,
    pricePeriod: (data.price_period as string | null) ?? "mensuel",
    residenceName: residence?.name ?? null,
    residenceImage: residence?.image_url ?? null,
    residenceLocation: residence ? [residence.neighborhood, residence.city].filter(Boolean).join(", ") : null,
  };
}

