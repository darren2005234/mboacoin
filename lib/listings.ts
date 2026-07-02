import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/components/mboacoin/listing-card";

/** Récupère les annonces publiées, les plus récentes d'abord. */
export async function getPublishedListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, bedrooms, image_url, status")
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur lecture annonces:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city].filter(Boolean).join(", "),
    price: row.price,
    priceSuffix: "/ mois",
    image: row.image_url ?? "/img/listings/demo-1.jpg",
    bedrooms: row.bedrooms ?? undefined,
    verified: true,
  }));
}

/** Récupère une annonce publiée par son id, ou null si introuvable. */
export async function getListingById(id: string): Promise<Listing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, bedrooms, image_url, status")
    .eq("id", id)
    .eq("status", "publiee")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    location: [data.neighborhood, data.city].filter(Boolean).join(", "),
    price: data.price,
    priceSuffix: "/ mois",
    image: data.image_url ?? "/img/listings/demo-1.jpg",
    bedrooms: data.bedrooms ?? undefined,
    verified: true,
  };
}