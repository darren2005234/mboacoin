import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/components/mboacoin/listing-card";
import { priceSuffixFor } from "@/lib/price-period";

export interface PublicResidence {
  id: string;
  name: string;
  city: string;
  neighborhood: string | null;
  description: string | null;
  imageUrl: string | null;
  managerVerified: boolean;
  listings: Listing[];
}

/** Récupère la fiche publique d'une résidence et ses logements publiés. */
export async function getPublicResidence(id: string): Promise<PublicResidence | null> {
  const supabase = await createClient();

  const { data: residence, error } = await supabase
    .from("residences")
    .select("id, name, city, neighborhood, description, image_url, manager_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !residence) return null;

  const { data: manager } = await supabase
    .from("profiles")
    .select("verification")
    .eq("id", residence.manager_id)
    .maybeSingle();

  const { data: listingsData } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, price_period, bedrooms, image_url, property_verified")
    .eq("residence_id", id)
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  const listings: Listing[] = (listingsData ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city].filter(Boolean).join(", "),
    price: row.price,
    priceSuffix: priceSuffixFor(row.price_period),
    image: row.image_url ?? "/img/listings/demo-1.jpg",
    bedrooms: row.bedrooms ?? undefined,
    verified: row.property_verified ?? false,
  }));

  return {
    id: residence.id,
    name: residence.name,
    city: residence.city,
    neighborhood: residence.neighborhood,
    description: residence.description,
    imageUrl: residence.image_url,
    managerVerified: manager?.verification === "verifie",
    listings,
  };
}
