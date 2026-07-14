import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

export interface EditableListing {
  title: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  advanceAmount: number | null;
  depositAmount: number | null;
  furnishing: string;
  water: string | null;
  electricity: string | null;
  amenities: string[];
  description: string | null;
  rooms: number | null;
  area: number | null;
  availableFrom: string | null;
  addressDescription: string | null;
  floorNumber: number | null;
  carAccess: boolean;
  floodZone: boolean;
  residenceId: string | null;
  pricePeriod: string;
  visitFeeAmount: number;
  ownerVerified: boolean;
}

/** Charge une annonce pour l'édition (seulement si on en est le propriétaire). */
export async function getListingForEdit(
  listingId: string
): Promise<EditableListing | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("listings")
    .select(
      "title, property_type, city, neighborhood, price, bedrooms, bathrooms, advance_amount, deposit_amount, visit_fee_amount, furnishing, water, electricity, amenities, description, owner_id, rooms, area, available_from, address_description, floor_number, car_access, flood_zone, residence_id, price_period"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) return null;
  if ((data as { owner_id: string }).owner_id !== user.id) return null; // pas le propriétaire

  const { data: profile } = await supabase
    .from("profiles")
    .select("verification")
    .eq("id", user.id)
    .maybeSingle();

  return {
    title: data.title,
    propertyType: data.property_type,
    city: data.city,
    neighborhood: data.neighborhood ?? "",
    price: data.price,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    advanceAmount: data.advance_amount,
    depositAmount: data.deposit_amount,
    furnishing: data.furnishing,
    water: data.water,
    electricity: data.electricity,
    amenities: data.amenities ?? [],
    description: data.description,
    rooms: data.rooms,
    area: data.area,
    availableFrom: data.available_from,
    addressDescription: data.address_description,
    floorNumber: data.floor_number ?? null,
    carAccess: data.car_access ?? false,
    floodZone: data.flood_zone ?? false,
    residenceId: (data.residence_id as string | null) ?? null,
    pricePeriod: (data.price_period as string | null) ?? "mensuel",
    visitFeeAmount: (data as { visit_fee_amount: number | null }).visit_fee_amount ?? 0,
    ownerVerified: profile?.verification === "verifie",
  };
}

export interface UpdateListingInput {
  title: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  price: number;
  pricePeriod: string;
  residenceId: string | null;
  bedrooms: number;
  bathrooms: number;
  advanceAmount: number | null;
  depositAmount: number | null;
  furnishing: string;
  water: string | null;
  electricity: string | null;
  amenities: string[];
  description: string;
  newFiles: File[];
  rooms: number | null;
  area: number | null;
  availableFrom: string | null;
  addressDescription: string | null;
  floorNumber: number | null;
  carAccess: boolean;
  floodZone: boolean;
  visitFeeAmount: number;
}

/** Met à jour une annonce et ajoute d'éventuelles nouvelles photos. */
export async function updateListing(
  listingId: string,
  input: UpdateListingInput
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  // Défense en profondeur (en plus de la RLS RESTRICTIVE sur listings) :
  // les frais de visite sont réservés aux comptes vérifiés, plafonnés à 10 000 FCFA.
  const { data: profile } = await supabase
    .from("profiles")
    .select("verification")
    .eq("id", user.id)
    .maybeSingle();
  const isVerified = profile?.verification === "verifie";
  const visitFeeAmount = isVerified ? Math.min(Math.max(input.visitFeeAmount || 0, 0), 10000) : 0;

  if (input.residenceId) {
    const { data: residence } = await supabase
      .from("residences")
      .select("manager_id")
      .eq("id", input.residenceId)
      .maybeSingle();
    if (!residence || residence.manager_id !== user.id) {
      return { error: "Résidence invalide." };
    }
  }

  // 1. Mise à jour des champs
  const { error } = await supabase
    .from("listings")
    .update({
      title: input.title,
      property_type: input.propertyType,
      city: input.city,
      neighborhood: input.neighborhood,
      price: input.price,
      price_period: input.pricePeriod,
      residence_id: input.residenceId,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms || null,
      advance_amount: input.advanceAmount,
      deposit_amount: input.depositAmount,
      furnishing: input.furnishing,
      water: input.water,
      electricity: input.electricity,
      amenities: input.amenities,
      description: input.description,
      rooms: input.rooms,
      area: input.area,
      available_from: input.availableFrom,
      address_description: input.addressDescription,
      floor_number: input.floorNumber,
      car_access: input.carAccess,
      flood_zone: input.floodZone,
      visit_fee_amount: visitFeeAmount,
    })
    .eq("id", listingId);

  if (error) {
    if (error.message.includes("row-level security")) {
      return { error: "Les frais de visite sont réservés aux comptes vérifiés." };
    }
    return { error: friendlyErrorMessage(error, "Impossible de mettre à jour l'annonce. Réessayez.") };
  }

  // 2. Ajout des nouvelles photos (s'il y en a)
  if (input.newFiles.length > 0) {
    // On récupère la position max actuelle pour continuer la numérotation
    const { data: existing } = await supabase
      .from("listing_media")
      .select("position")
      .eq("listing_id", listingId)
      .order("position", { ascending: false })
      .limit(1);

    let position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    for (const file of input.newFiles) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("listings")
        .upload(path, file, { upsert: false });
      if (upErr) return { error: `Upload photo : ${upErr.message}` };

      await supabase.from("listing_media").insert({
        listing_id: listingId,
        storage_path: path,
        position,
      });
      position++;
    }
  }

  return { success: true };
}