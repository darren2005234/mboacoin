import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

export interface ListingVerifStatus {
  status: "aucune" | "en_attente" | "validee" | "rejetee";
  rejectionReason: string | null;
}

/** État de la dernière demande de vérification d'un logement. */
export async function getListingVerifStatus(listingId: string): Promise<ListingVerifStatus> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "aucune", rejectionReason: null };

  const { data } = await supabase
    .from("listing_verifications")
    .select("status, rejection_reason")
    .eq("listing_id", listingId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { status: "aucune", rejectionReason: null };
  return {
    status: data.status as ListingVerifStatus["status"],
    rejectionReason: data.rejection_reason ?? null,
  };
}

/** Soumet une vidéo de vérification pour un logement. */
export async function submitListingVerification(
  listingId: string,
  file: File
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `${user.id}/${listingId}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("property-videos")
    .upload(path, file, { upsert: false });
  if (upErr) return { error: `Envoi de la vidéo : ${upErr.message}` };

  const { error } = await supabase.from("listing_verifications").insert({
    listing_id: listingId,
    owner_id: user.id,
    video_path: path,
  });
  if (error) return { error: friendlyErrorMessage(error, "Impossible d'envoyer la vidéo de vérification. Réessayez.") };

  return { success: true };
}

/** Vérifie la durée d'une vidéo (en secondes) côté navigateur. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Impossible de lire la vidéo"));
    };
    video.src = URL.createObjectURL(file);
  });
}