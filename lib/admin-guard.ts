import { createClient } from "@/lib/supabase/client";

/** Vérifie côté client que l'utilisateur connecté est admin, avant une action d'administration. */
export async function requireAdminClient(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Vous devez être connecté." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "Action réservée aux administrateurs." };

  return { ok: true };
}
