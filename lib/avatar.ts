import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";

/** Téléverse une nouvelle photo de profil et met à jour le profil. Retourne l'URL. */
export async function uploadAvatar(file: File): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  // Compression : un avatar s'affiche petit, on peut réduire fortement
  let toUpload: File = file;
  if (file.type.startsWith("image/")) {
    try {
      toUpload = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
    } catch {
      toUpload = file; // si la compression échoue, on garde l'originale
    }
  }

  // On force l'extension jpg car la compression convertit généralement en jpeg
  const path = `${user.id}/avatar.jpg`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, toUpload, { upsert: true });
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