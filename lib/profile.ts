import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  id: string;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  role: string;
  verification: string;
  accountType: string;
}

/** Récupère l'utilisateur connecté et son profil, ou null si pas de session. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, city, avatar_url, role, verification, account_type")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    fullName: data?.full_name ?? null,
    phone: data?.phone ?? user.phone ?? null,
    city: data?.city ?? null,
    avatarUrl: data?.avatar_url ?? null,
    role: data?.role ?? "locataire",
    verification: data?.verification ?? "non_verifie",
    accountType: data?.account_type ?? "personne_physique",
  };
}