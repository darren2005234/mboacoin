import { createClient } from "@/lib/supabase/client";

export interface NewListingInput {
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
  files: File[];
  rooms: number | null;
  area: number | null;
  availableFrom: string | null;
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
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms || null,
      advance_months: input.advanceMonths,
      deposit_months: input.depositMonths,
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
    })
    .select("id")
    .single();

  if (error) return { error: `Création : ${error.message}` };

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