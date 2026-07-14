import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

export interface EditableProfile {
  fullName: string;
  city: string;
  email: string;
  bio: string;
  accountType: string;
}

/** Charge les infos modifiables du profil de l'utilisateur courant. */
export async function getMyProfileForEdit(): Promise<EditableProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, city, email, bio, account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    fullName: data.full_name ?? "",
    city: data.city ?? "",
    email: data.email ?? "",
    bio: data.bio ?? "",
    accountType: data.account_type ?? "personne_physique",
  };
}

/** Enregistre les modifications du profil. */
export async function updateMyProfile(input: {
  fullName: string;
  city: string;
  email: string;
  bio: string;
  accountType: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  // Validation simple de l'email s'il est renseigné
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "L'adresse e-mail n'est pas valide." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      city: input.city.trim() || null,
      email: email || null,
      bio: input.bio.trim() || null,
      account_type: input.accountType,
    })
    .eq("id", user.id);

  if (error) return { error: friendlyErrorMessage(error, "Impossible d'enregistrer le profil. Réessayez.") };
  return { success: true };
}