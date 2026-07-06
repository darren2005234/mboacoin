import { createClient } from "@/lib/supabase/client";

export interface PendingVerification {
  id: string;
  userId: string;
  userName: string;
  documentType: string | null;
  documentUrl: string;
  isPdf: boolean;
  createdAt: string;
}

/** Liste les demandes de vérification en attente (admin uniquement). */
export async function getPendingVerifications(): Promise<PendingVerification[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("verification_requests")
    .select("id, user_id, document_path, document_type, created_at, profiles(full_name)")
    .eq("status", "en_attente")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const results: PendingVerification[] = [];
  for (const row of data) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    // URL signée temporaire pour voir le document privé (valable 1h)
    const { data: signed } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(row.document_path, 3600);

    results.push({
      id: row.id,
      userId: row.user_id,
      userName: profile?.full_name ?? "Utilisateur",
      documentType: row.document_type,
      documentUrl: signed?.signedUrl ?? "",
      isPdf: row.document_path.toLowerCase().endsWith(".pdf"),
      createdAt: row.created_at,
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