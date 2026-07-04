import { createClient } from "@/lib/supabase/client";

/** Téléverse une nouvelle photo de profil et met à jour le profil. Retourne l'URL. */
export async function uploadAvatar(file: File): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const ext = file.name.split(".").pop() ?? "jpg";
  // Un chemin fixe par utilisateur, écrasé à chaque changement
  const path = `${user.id}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (upErr) return { error: `Upload : ${upErr.message}` };

  // URL publique, avec un paramètre anti-cache pour forcer le rafraîchissement
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  // On enregistre l'URL dans le profil
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (updErr) return { error: `Enregistrement : ${updErr.message}` };

  return { url };
}