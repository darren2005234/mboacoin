import { createClient } from "@/lib/supabase/client";

export interface NewListingInput {
  title: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  advanceMonths: number;
  depositMonths: number;
  description: string;
  files: File[];
}

export interface CreateListingResult {
  id?: string;
  error?: string;
}

/** Téléverse les photos puis crée l'annonce. Retourne l'id, ou une erreur. */
export async function createListing(input: NewListingInput): Promise<CreateListingResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  // 1. Téléverser les photos
  const urls: string[] = [];
  for (const file of input.files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("listings")
      .upload(path, file, { upsert: false });
    if (upErr) return { error: `Upload photo : ${upErr.message}` };

    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  // 2. Insérer l'annonce (première photo = image principale)
  const { data, error } = await supabase
    .from("listings")
    .insert({
      owner_id: user.id,
      title: input.title,
      property_type: input.propertyType,
      city: input.city,
      neighborhood: input.neighborhood,
      price: input.price,
      bedrooms: input.bedrooms,
      advance_months: input.advanceMonths,
      deposit_months: input.depositMonths,
      description: input.description,
      image_url: urls[0] ?? null,
      status: "publiee",
    })
    .select("id")
    .single();

  if (error) return { error: `Création : ${error.message}` };
  return { id: data.id };
}