import { createClient } from "@/lib/supabase/client";

export interface VerificationStatus {
  status: "aucune" | "en_attente" | "validee" | "rejetee";
  rejectionReason: string | null;
}

/** Récupère l'état de la dernière demande de vérification de l'utilisateur. */
export async function getMyVerificationStatus(): Promise<VerificationStatus> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "aucune", rejectionReason: null };

  const { data } = await supabase
    .from("verification_requests")
    .select("status, rejection_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { status: "aucune", rejectionReason: null };
  return {
    status: data.status as VerificationStatus["status"],
    rejectionReason: data.rejection_reason ?? null,
  };
}

/** Soumet un document d'identité pour vérification. */
export async function submitVerification(
  file: File,
  documentType: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  // Chemin dans le dossier de l'utilisateur (exigé par la règle de sécurité)
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("identity-documents")
    .upload(path, file, { upsert: false });
  if (upErr) return { error: `Envoi du document : ${upErr.message}` };

  const { error } = await supabase.from("verification_requests").insert({
    user_id: user.id,
    document_path: path,
    document_type: documentType,
  });
  if (error) return { error: error.message };

  // On met le profil en "en attente" pour refléter l'état
  await supabase
    .from("profiles")
    .update({ verification: "en_attente" })
    .eq("id", user.id);

  return { success: true };
}