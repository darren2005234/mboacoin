import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/components/mboacoin/listing-card";
import { priceSuffixFor } from "@/lib/price-period";
import { friendlyErrorMessage } from "@/lib/supabase-error";

export interface MyListing extends Listing {
  status: string;
  propertyVerified: boolean;
}

/** Récupère les annonces de l'utilisateur connecté, tous statuts confondus. */
export async function getMyListings(): Promise<MyListing[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, price_period, bedrooms, image_url, status, property_verified, residence_id, residence:residences(name)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const residence = Array.isArray(row.residence) ? row.residence[0] : row.residence;
    return {
      id: row.id,
      title: row.title,
      location: [row.neighborhood, row.city].filter(Boolean).join(", "),
      price: row.price,
      priceSuffix: priceSuffixFor(row.price_period),
      image: row.image_url ?? "/img/listings/demo-1.jpg",
      bedrooms: row.bedrooms ?? undefined,
      verified: false,
      status: row.status,
      propertyVerified: row.property_verified ?? false,
      residenceId: row.residence_id ?? undefined,
      residenceName: residence?.name ?? undefined,
    };
  });
}

/** Change le statut d'une annonce (ex: la marquer louée, ou la republier). */
export async function updateListingStatus(listingId: string, status: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", listingId);
  if (error) return { error: friendlyErrorMessage(error, "Impossible de changer le statut de l'annonce. Réessayez.") };
  return { success: true };
}

/** Supprime une annonce (ses photos et médias suivent via cascade). */
export async function deleteListing(listingId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) return { error: friendlyErrorMessage(error, "Impossible de supprimer cette annonce. Réessayez.") };
  return { success: true };
}