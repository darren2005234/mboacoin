import { createClient } from "@/lib/supabase/client";

export interface NewListingInput {
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
  files: File[];
  rooms: number | null;
  area: number | null;
  availableFrom: string | null;
  addressDescription: string | null;
  floorNumber: number | null;
  carAccess: boolean;
  floodZone: boolean;
  visitFeeAmount: number;
}

export interface CreateListingResult {
  id?: string;
  error?: string;
}

export async function createListing(input: NewListingInput): Promise<CreateListingResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, verification")
    .eq("id", user.id)
    .maybeSingle();
  const needsVerification = profile?.account_type === "agence" || profile?.account_type === "residence";
  if (needsVerification && profile?.verification !== "verifie") {
    return { error: "Votre compte doit être vérifié pour publier une annonce." };
  }

  // Défense en profondeur (en plus de la RLS RESTRICTIVE sur listings) :
  // les frais de visite sont réservés aux comptes vérifiés, plafonnés à 10 000 FCFA.
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

  // 1. Téléverser les photos et mémoriser leurs chemins
  const paths: string[] = [];
  for (const file of input.files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("listings")
      .upload(path, file, { upsert: false });
    if (upErr) return { error: `Upload photo : ${upErr.message}` };
    paths.push(path);
  }

  // 2. Créer l'annonce (première photo comme aperçu principal)
  const firstUrl =
    paths.length > 0
      ? supabase.storage.from("listings").getPublicUrl(paths[0]).data.publicUrl
      : null;

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      owner_id: user.id,
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
      image_url: firstUrl,
      status: "publiee",
      rooms: input.rooms,
      area: input.area,
      available_from: input.availableFrom,
      address_description: input.addressDescription,
      floor_number: input.floorNumber,
      car_access: input.carAccess,
      flood_zone: input.floodZone,
      visit_fee_amount: visitFeeAmount,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("row-level security")) {
      return { error: "Les frais de visite sont réservés aux comptes vérifiés." };
    }
    return { error: `Création : ${error.message}` };
  }

  // 3. Enregistrer chaque photo dans listing_media
  if (paths.length > 0) {
    const rows = paths.map((path, i) => ({
      listing_id: listing.id,
      storage_path: path,
      position: i,
    }));
    const { error: mediaErr } = await supabase.from("listing_media").insert(rows);
    if (mediaErr) return { error: `Enregistrement photos : ${mediaErr.message}` };
  }

  return { id: listing.id };
}