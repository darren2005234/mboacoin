"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function completeProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

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

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, city: city || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Enregistrement impossible. Réessayez." };
  }

  redirect("/explore");
}