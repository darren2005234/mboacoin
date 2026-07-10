import { createClient } from "@/lib/supabase/client";

export interface EditableListing {
  title: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  advanceMonths: number | null;
  depositMonths: number | null;
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
      "title, property_type, city, neighborhood, price, bedrooms, bathrooms, advance_months, deposit_months, furnishing, water, electricity, amenities, description, owner_id, rooms, area, available_from, address_description, floor_number, car_access, flood_zone, residence_id, price_period"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) return null;
  if ((data as { owner_id: string }).owner_id !== user.id) return null; // pas le propriétaire

  return {
    title: data.title,
    propertyType: data.property_type,
    city: data.city,
    neighborhood: data.neighborhood ?? "",
    price: data.price,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    advanceMonths: data.advance_months,
    depositMonths: data.deposit_months,
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
  };
}

export interface UpdateListingInput {
  title: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  advanceMonths: number;
  depositMonths: number;
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

  // 1. Mise à jour des champs
  const { error } = await supabase
    .from("listings")
    .update({
      title: input.title,
      property_type: input.propertyType,
      city: input.city,
      neighborhood: input.neighborhood,
      price: input.price,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms || null,
      advance_months: input.advanceMonths,
      deposit_months: input.depositMonths,
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
    })
    .eq("id", listingId);

  if (error) return { error: `Mise à jour : ${error.message}` };

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