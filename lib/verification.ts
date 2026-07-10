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
  const { error: upErr } = await supabase.storage
    .from("identity-documents")
    .upload(docPath, file, { upsert: false });
  if (upErr) return { error: `Envoi du document : ${upErr.message}` };

  // Selfie pris en direct
  const selfiePath = `${user.id}/${Date.now()}-selfie.jpg`;
  const { error: selfieErr } = await supabase.storage
    .from("identity-documents")
    .upload(selfiePath, selfie, { upsert: false });
  if (selfieErr) return { error: `Envoi du selfie : ${selfieErr.message}` };

  // Document d'entité (agence/résidence uniquement)
  let entityDocumentPath: string | null = null;
  if (entity) {
    const entityExt = entity.file.name.split(".").pop() ?? "jpg";
    const entityPath = `${user.id}/${Date.now()}-entity.${entityExt}`;
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
    selfie_path: selfiePath,
    entity_document_path: entityDocumentPath,
    entity_document_type: entity ? entity.type : null,
  });
  if (error) return { error: error.message };

  await supabase
    .from("profiles")
    .update({ verification: "en_attente" })
    .eq("id", user.id);

  return { success: true };
}