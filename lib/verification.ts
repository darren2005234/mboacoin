import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

/**
 * Empreinte SHA-256 (hex) d'un fichier, calculée AVANT l'envoi — le fichier
 * doit exister pour être hashé, donc jamais au moment de la purge (voir
 * 20260717100000_data_retention_purge.sql). Web Crypto API, aucune
 * dépendance : preuve d'intégrité de ce qui a été vu par l'admin, conservée
 * même après suppression du fichier lui-même.
 */
async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

/** Récupère le type de compte de l'utilisateur courant (côté navigateur). */
export async function getMyAccountType(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "personne_physique";

  const { data } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  return data?.account_type ?? "personne_physique";
}

/** Soumet un document d'identité + un selfie pris en direct pour vérification, avec en option un document d'entité (agence/résidence). */
export async function submitVerification(
  file: File,
  documentType: string,
  selfie: File,
  entity?: { file: File; type: string }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  // Document d'identité
  const ext = file.name.split(".").pop() ?? "jpg";
  const docPath = `${user.id}/${Date.now()}-doc.${ext}`;
  const documentHash = await sha256Hex(file);
  const { error: upErr } = await supabase.storage
    .from("identity-documents")
    .upload(docPath, file, { upsert: false });
  if (upErr) return { error: `Envoi du document : ${upErr.message}` };

  // Selfie pris en direct
  const selfiePath = `${user.id}/${Date.now()}-selfie.jpg`;
  const selfieHash = await sha256Hex(selfie);
  const { error: selfieErr } = await supabase.storage
    .from("identity-documents")
    .upload(selfiePath, selfie, { upsert: false });
  if (selfieErr) return { error: `Envoi du selfie : ${selfieErr.message}` };

  // Document d'entité (agence/résidence uniquement)
  let entityDocumentPath: string | null = null;
  let entityDocumentHash: string | null = null;
  if (entity) {
    const entityExt = entity.file.name.split(".").pop() ?? "jpg";
    const entityPath = `${user.id}/${Date.now()}-entity.${entityExt}`;
    entityDocumentHash = await sha256Hex(entity.file);
    const { error: entityErr } = await supabase.storage
      .from("identity-documents")
      .upload(entityPath, entity.file, { upsert: false });
    if (entityErr) return { error: `Envoi du document d'entité : ${entityErr.message}` };
    entityDocumentPath = entityPath;
  }

  const { error } = await supabase.from("verification_requests").insert({
    user_id: user.id,
    document_path: docPath,
    document_type: documentType,
    document_hash: documentHash,
    selfie_path: selfiePath,
    selfie_hash: selfieHash,
    entity_document_path: entityDocumentPath,
    entity_document_type: entity ? entity.type : null,
    entity_document_hash: entityDocumentHash,
  });
  if (error) return { error: friendlyErrorMessage(error, "Impossible d'envoyer votre demande de vérification. Réessayez.") };

  await supabase
    .from("profiles")
    .update({ verification: "en_attente" })
    .eq("id", user.id);

  return { success: true };
}