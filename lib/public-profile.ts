import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/components/mboacoin/listing-card";

export interface PublicProfile {
  id: string;
  fullName: string;
  city: string | null;
  avatarUrl: string | null;
  verified: boolean;
  memberSince: string | null;
  listings: Listing[];
  bio: string | null
}

/** Récupère le profil public d'un utilisateur et ses annonces publiées. */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, city, avatar_url, verification, created_at, bio")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return null;

  const { data: listingsData } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, bedrooms, image_url")
    .eq("owner_id", userId)
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  const verified = profile.verification === "verifie";

  const listings: Listing[] = (listingsData ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city].filter(Boolean).join(", "),
    price: row.price,
    priceSuffix: "/ mois",
    image: row.image_url ?? "/img/listings/demo-1.jpg",
    bedrooms: row.bedrooms ?? undefined,
    verified,
  }));

  return {
    id: profile.id,
    fullName: profile.full_name ?? "Utilisateur",
    city: profile.city,
    avatarUrl: profile.avatar_url,
    verified,
    memberSince: profile.created_at,
    listings,
    bio: profile.bio ?? null,
  };
}