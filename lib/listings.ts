import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/components/mboacoin/listing-card";

/** Récupère les annonces publiées, les plus récentes d'abord. */
export async function getPublishedListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, city, neighborhood, price, bedrooms, image_url, status, owner:profiles(full_name, verification)"
    )
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur lecture annonces:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
    return {
      id: row.id,
      title: row.title,
      location: [row.neighborhood, row.city].filter(Boolean).join(", "),
      price: row.price,
      priceSuffix: "/ mois",
      image: row.image_url ?? "/img/listings/demo-1.jpg",
      bedrooms: row.bedrooms ?? undefined,
      verified: owner?.verification === "verifie",
    };
  });
}

/** Récupère une annonce publiée par son id, ou null si introuvable. */
export async function getListingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, description, city, neighborhood, price, bedrooms, advance_months, deposit_months, image_url, status, owner:profiles(full_name, verification), media:listing_media(storage_path, position)"
    )
    .eq("id", id)
    .eq("status", "publiee")
    .maybeSingle();

  if (error || !data) return null;

  const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner;

  // Reconstruire les URLs publiques des photos, triées par position
  const media = (data.media ?? []) as { storage_path: string; position: number }[];
  const images = media
    .sort((a, b) => a.position - b.position)
    .map((m) => supabase.storage.from("listings").getPublicUrl(m.storage_path).data.publicUrl);

  // Repli sur image_url si aucune photo dans listing_media
  const gallery = images.length > 0 ? images : data.image_url ? [data.image_url] : [];

  return {
    id: data.id,
    title: data.title,
    description: (data.description as string | null) ?? null,
    location: [data.neighborhood, data.city].filter(Boolean).join(", "),
    price: data.price,
    priceSuffix: "/ mois",
    images: gallery,
    bedrooms: data.bedrooms ?? undefined,
    advanceMonths: data.advance_months ?? null,
    depositMonths: data.deposit_months ?? null,
    ownerName: owner?.full_name ?? "Bailleur",
    verified: owner?.verification === "verifie",
  };
}