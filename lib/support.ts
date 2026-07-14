import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

/** Catégories de ticket, source unique de vérité pour l'UI. */
export const SUPPORT_CATEGORIES = ["verification", "paiement", "litige", "arnaque", "compte", "autre"] as const;

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  verification: "Vérification (identité ou annonce)",
  paiement: "Paiement (quittance, loyer, versement)",
  litige: "Litige avec un bailleur ou un locataire",
  arnaque: "Signaler une arnaque",
  compte: "Accès à mon compte",
  autre: "Autre",
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

const COMPRESSION_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true };

async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith("image/")) return file;
      try {
        return await imageCompression(file, COMPRESSION_OPTIONS);
      } catch {
        return file;
      }
    })
  );
}

/** Chemin de stockage keyé par le jeton de suivi (pas l'id du ticket) — voir 20260716100000, section A.8. */
async function uploadSupportAttachment(followUpToken: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${followUpToken}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("support-tickets").upload(path, file, { upsert: false });
  return error ? null : path;
}

export async function getSupportAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("support-tickets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface CreateSupportTicketInput {
  category: string;
  subject: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  files?: File[];
}

export interface CreateSupportTicketResult {
  id?: string;
  followUpToken?: string;
  error?: string;
}

/**
 * Crée un ticket de support — connecté ou visiteur, un seul chemin. Toujours
 * via create_support_ticket() (RPC) : un insert direct anonyme ne pourrait
 * pas renvoyer follow_up_token (RETURNING est filtré par les policies
 * SELECT, et anon n'en a aucune sur support_tickets — voir la migration).
 */
export async function createSupportTicket(input: CreateSupportTicketInput): Promise<CreateSupportTicketResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("create_support_ticket", {
      p_category: input.category,
      p_subject: input.subject,
      p_description: input.description,
      p_contact_email: input.contactEmail || null,
      p_contact_phone: input.contactPhone || null,
    })
    .single();

  if (error || !data) return { error: error?.message || "Impossible d'envoyer votre demande." };

  const { id, follow_up_token: followUpToken } = data as { id: string; follow_up_token: string };

  // Toujours via la fonction à jeton, même pour un créateur connecté : un
  // insert direct échouerait pour un visiteur anonyme (RLS compare
  // uploaded_by = auth.uid(), et NULL = NULL n'est jamais vrai en SQL — la
  // ligne serait rejetée en silence). La fonction à jeton n'a pas ce
  // problème, et fonctionne à l'identique pour les deux cas : un seul
  // chemin, pas de branche à maintenir.
  if (input.files && input.files.length > 0) {
    const compressed = await compressImages(input.files);
    for (const file of compressed) {
      const path = await uploadSupportAttachment(followUpToken, file);
      if (path) {
        await supabase.rpc("add_support_ticket_attachment_by_token", {
          p_token: followUpToken,
          p_storage_path: path,
        });
      }
    }
  }

  return { id, followUpToken };
}

export interface SupportTicketSummary {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  statusChangedAt: string;
}

/** Tickets de l'utilisateur connecté (RLS scope déjà à user_id = auth.uid()). */
export async function getMySupportTickets(): Promise<SupportTicketSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, category, subject, status, created_at, status_changed_at")
    .order("status_changed_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
  }));
}

export interface SupportAttachment {
  id: string;
  storagePath: string;
}

export interface SupportThreadMessage {
  id: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
  attachments: SupportAttachment[];
}

export interface SupportTicketDetail {
  id: string;
  followUpToken: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  statusChangedAt: string;
}

export interface SupportTicketThread {
  ticket: SupportTicketDetail;
  ticketAttachments: SupportAttachment[];
  messages: SupportThreadMessage[];
}

function groupAttachments(rows: { id: string; message_id: string | null; storage_path: string }[]) {
  const byMessage = new Map<string | null, SupportAttachment[]>();
  for (const a of rows) {
    const list = byMessage.get(a.message_id) ?? [];
    list.push({ id: a.id, storagePath: a.storage_path });
    byMessage.set(a.message_id, list);
  }
  return byMessage;
}

/** Fil complet d'un ticket de l'utilisateur connecté (RLS : uniquement le sien). */
export async function getSupportTicketThread(ticketId: string): Promise<SupportTicketThread | null> {
  const supabase = createClient();

  const { data: ticketRow } = await supabase
    .from("support_tickets")
    .select("id, follow_up_token, category, subject, description, status, created_at, status_changed_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticketRow) return null;

  const [{ data: msgRows }, { data: attRows }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, is_admin, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase.from("support_ticket_attachments").select("id, message_id, storage_path").eq("ticket_id", ticketId),
  ]);

  const attachmentsByMessage = groupAttachments(attRows ?? []);

  return {
    ticket: {
      id: ticketRow.id,
      followUpToken: ticketRow.follow_up_token,
      category: ticketRow.category,
      subject: ticketRow.subject,
      description: ticketRow.description,
      status: ticketRow.status,
      createdAt: ticketRow.created_at,
      statusChangedAt: ticketRow.status_changed_at,
    },
    ticketAttachments: attachmentsByMessage.get(null) ?? [],
    messages: (msgRows ?? []).map((m) => ({
      id: m.id,
      isAdmin: m.is_admin,
      body: m.body,
      createdAt: m.created_at,
      attachments: attachmentsByMessage.get(m.id) ?? [],
    })),
  };
}

/** Répond dans le fil d'un ticket qu'on possède (utilisateur connecté). */
export async function sendSupportMessage(
  ticketId: string,
  followUpToken: string,
  body: string,
  files: File[] = []
): Promise<{ error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Le message est vide." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, body: trimmed })
    .select("id")
    .single();

  if (error || !data) return { error: "Impossible d'envoyer le message." };

  if (files.length > 0) {
    const compressed = await compressImages(files);
    for (const file of compressed) {
      const path = await uploadSupportAttachment(followUpToken, file);
      if (path) {
        await supabase
          .from("support_ticket_attachments")
          .insert({ ticket_id: ticketId, message_id: data.id, storage_path: path });
      }
    }
  }

  return {};
}

// ============================================================================
// Chemin visiteur — par jeton, via les fonctions SECURITY DEFINER dédiées.
// ============================================================================

/** Ticket d'un visiteur via son jeton de suivi, ou null si jeton invalide. */
export async function getSupportTicketByToken(token: string): Promise<SupportTicketDetail | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc("get_support_ticket_by_token", { p_token: token }).maybeSingle();
  if (!data) return null;
  const row = data as {
    id: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    created_at: string;
    status_changed_at: string;
  };
  return {
    id: row.id,
    followUpToken: token,
    category: row.category,
    subject: row.subject,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
  };
}

/** Fil de messages d'un ticket visiteur via son jeton, pièces jointes incluses. */
export async function getSupportTicketThreadByToken(
  token: string
): Promise<{ messages: SupportThreadMessage[]; ticketAttachments: SupportAttachment[] }> {
  const supabase = createClient();
  const [{ data: msgRows }, { data: attRows }] = await Promise.all([
    supabase.rpc("get_support_ticket_messages_by_token", { p_token: token }),
    supabase.rpc("get_support_ticket_attachments_by_token", { p_token: token }),
  ]);

  const attachmentsByMessage = groupAttachments(
    (attRows ?? []) as { id: string; message_id: string | null; storage_path: string }[]
  );

  return {
    ticketAttachments: attachmentsByMessage.get(null) ?? [],
    messages: ((msgRows ?? []) as { id: string; is_admin: boolean; body: string; created_at: string }[]).map(
      (m) => ({
        id: m.id,
        isAdmin: m.is_admin,
        body: m.body,
        createdAt: m.created_at,
        attachments: attachmentsByMessage.get(m.id) ?? [],
      })
    ),
  };
}

/** Répond dans le fil d'un ticket visiteur, avec pièces jointes éventuelles. */
export async function addSupportTicketMessageByToken(
  token: string,
  body: string,
  files: File[] = []
): Promise<{ error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Le message est vide." };

  const supabase = createClient();
  const { error } = await supabase.rpc("add_support_ticket_message_by_token", { p_token: token, p_body: trimmed });
  if (error) return { error: error.message || "Impossible d'envoyer le message." };

  if (files.length > 0) {
    const compressed = await compressImages(files);
    for (const file of compressed) {
      const path = await uploadSupportAttachment(token, file);
      if (path) {
        await supabase.rpc("add_support_ticket_attachment_by_token", { p_token: token, p_storage_path: path });
      }
    }
  }

  return {};
}
