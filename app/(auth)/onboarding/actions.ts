"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function completeProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const accountType = String(formData.get("account_type") ?? "personne_physique");

  if (!fullName) {
    return { error: "Le nom est obligatoire." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session introuvable. Reconnectez-vous." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      city: city || null,
      account_type: accountType,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select();

  if (error) {
    return { error: `Erreur base : ${error.message}` };
  }

  if (!data || data.length === 0) {
    return { error: "Aucune ligne modifiée (profil introuvable ou bloqué par la sécurité)." };
  }

  redirect("/explore");
}