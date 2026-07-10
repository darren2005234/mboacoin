import { createClient } from "@/lib/supabase/client";

export interface PendingVerification {
  id: string;
  userId: string;
  userName: string;
  documentType: string | null;
  documentUrl: string;
  selfieUrl: string;
  isPdf: boolean;
  createdAt: string;
  entityDocumentUrl: string | null;
  entityDocumentType: string | null;
  entityIsPdf: boolean;
}

/** Liste les demandes de vérification en attente (admin uniquement). */
export async function getPendingVerifications(): Promise<PendingVerification[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      "id, user_id, document_path, selfie_path, document_type, entity_document_path, entity_document_type, created_at, profiles(full_name)"
    )
    .eq("status", "en_attente")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const results: PendingVerification[] = [];
  for (const row of data) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    // URL signée du document (1h)
    const { data: signed } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(row.document_path, 3600);

    // URL signée du selfie (1h), si présent
    let selfieUrl = "";
    if (row.selfie_path) {
      const { data: signedSelfie } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(row.selfie_path, 3600);
      selfieUrl = signedSelfie?.signedUrl ?? "";
    }

    // URL signée du document d'entité (1h), si présent (agence/résidence)
    let entityDocumentUrl: string | null = null;
    if (row.entity_document_path) {
      const { data: signedEntity } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(row.entity_document_path, 3600);
      entityDocumentUrl = signedEntity?.signedUrl ?? "";
    }

    results.push({
      id: row.id,
      userId: row.user_id,
      userName: profile?.full_name ?? "Utilisateur",
      documentType: row.document_type,
      documentUrl: signed?.signedUrl ?? "",
      selfieUrl,
      isPdf: row.document_path.toLowerCase().endsWith(".pdf"),
      createdAt: row.created_at,
      entityDocumentUrl,
      entityDocumentType: row.entity_document_type,
      entityIsPdf: row.entity_document_path ? row.entity_document_path.toLowerCase().endsWith(".pdf") : false,
    });
  }
  return results;
}

/** Valide une demande : profil vérifié + demande validée. */
export async function approveVerification(requestId: string, userId: string) {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("verification_requests")
    .update({ status: "validee", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("profiles")
    .update({ verification: "verifie" })
    .eq("id", userId);
  if (e2) return { error: e2.message };

  return { success: true };
}

/** Rejette une demande avec un motif. */
export async function rejectVerification(requestId: string, userId: string, reason: string) {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("verification_requests")
    .update({ status: "rejetee", reviewed_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", requestId);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("profiles")
    .update({ verification: "rejete" })
    .eq("id", userId);
  if (e2) return { error: e2.message };

  return { success: true };
}