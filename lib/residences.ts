import { createClient } from "@/lib/supabase/client";

export interface Residence {
  id: string;
  name: string;
  city: string;
  neighborhood: string | null;
  imageUrl: string | null;
}

/** Récupère les résidences du gestionnaire connecté. */
export async function getMyResidences(): Promise<Residence[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("residences")
    .select("id, name, city, neighborhood, image_url")
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    neighborhood: row.neighborhood,
    imageUrl: row.image_url,
  }));
}

export interface NewResidenceInput {
  name: string;
  city: string;
  neighborhood: string | null;
  addressDescription: string | null;
  description: string | null;
  file: File | null;
}

export interface CreateResidenceResult {
  id?: string;
  error?: string;
}

/** Crée une résidence pour le gestionnaire connecté. */
export async function createResidence(input: NewResidenceInput): Promise<CreateResidenceResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_type !== "residence") {
    return { error: "Seuls les comptes résidence peuvent créer une résidence." };
  }

  let imageUrl: string | null = null;
  if (input.file) {
    const ext = input.file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/residence-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("listings")
      .upload(path, input.file, { upsert: false });
    if (upErr) return { error: `Upload image : ${upErr.message}` };
    imageUrl = supabase.storage.from("listings").getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await supabase
    .from("residences")
    .insert({
      manager_id: user.id,
      name: input.name,
      city: input.city,
      neighborhood: input.neighborhood,
      address_description: input.addressDescription,
      description: input.description,
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (error) return { error: `Création : ${error.message}` };
  return { id: data.id };
}

export interface EditableResidence {
  name: string;
  city: string;
  neighborhood: string;
  addressDescription: string;
  description: string;
  imageUrl: string | null;
}

/** Charge une résidence pour l'édition (seulement si on en est le gestionnaire). */
export async function getResidenceForEdit(id: string): Promise<EditableResidence | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("residences")
    .select("name, city, neighborhood, address_description, description, image_url, manager_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  if ((data as { manager_id: string }).manager_id !== user.id) return null; // pas le gestionnaire

  return {
    name: data.name,
    city: data.city,
    neighborhood: data.neighborhood ?? "",
    addressDescription: data.address_description ?? "",
    description: data.description ?? "",
    imageUrl: data.image_url,
  };
}

export interface UpdateResidenceInput {
  name: string;
  city: string;
  neighborhood: string | null;
  addressDescription: string | null;
  description: string | null;
  newFile: File | null;
}

/** Met à jour une résidence, avec une nouvelle image optionnelle. */
export async function updateResidence(
  id: string,
  input: UpdateResidenceInput
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_type !== "residence") {
    return { error: "Seuls les comptes résidence peuvent modifier une résidence." };
  }

  let imageUrl: string | undefined;
  if (input.newFile) {
    const ext = input.newFile.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/residence-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("listings")
      .upload(path, input.newFile, { upsert: false });
    if (upErr) return { error: `Upload image : ${upErr.message}` };
    imageUrl = supabase.storage.from("listings").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase
    .from("residences")
    .update({
      name: input.name,
      city: input.city,
      neighborhood: input.neighborhood,
      address_description: input.addressDescription,
      description: input.description,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .eq("id", id);

  if (error) return { error: `Mise à jour : ${error.message}` };
  return { success: true };
}

/** Supprime une résidence. */
export async function deleteResidence(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_type !== "residence") {
    return { error: "Seuls les comptes résidence peuvent supprimer une résidence." };
  }

  const { error } = await supabase.from("residences").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
