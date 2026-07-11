import { redirect } from "next/navigation";
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

/**
 * Garde d'accès serveur : redirige si l'utilisateur n'est pas connecté ou si son
 * compte n'est pas du type requis. À appeler en tête d'un Server Component de page.
 */
export async function requireAccountType(type: string, fallback = "/profile"): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.accountType !== type) redirect(fallback);
  return profile;
}

/**
 * Garde d'accès serveur réservée aux administrateurs. Redirige avant tout rendu
 * si l'utilisateur n'est pas connecté ou si son rôle n'est pas "admin".
 */
export async function requireAdmin(fallback = "/explore"): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect(fallback);
  return profile;
}