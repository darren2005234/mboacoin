import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";
import { compressImages } from "@/lib/image-compression";

export const MAX_ATTACHMENTS_PER_MESSAGE = 6;
export const MAX_ATTACHMENT_RAW_SIZE_MB = 15;

interface AttachmentLike {
  type: string;
  size: number;
}

/**
 * Validation pure (aucun accès réseau) des pièces jointes d'un message, avant
 * tout upload : type image uniquement, taille brute raisonnable avant
 * compression, nombre plafonné (miroir du plafond vérifié en base par
 * message_attachments_before_insert). Un message doit avoir du texte OU au
 * moins une image — jamais les deux vides.
 */
export function validateMessageAttachments(files: AttachmentLike[], hasBody: boolean): string | null {
  if (files.length === 0 && !hasBody) {
    return "Écrivez un message ou joignez au moins une image.";
  }
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} images par message.`;
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return "Seules les images sont acceptées en pièce jointe.";
    }
    if (file.size > MAX_ATTACHMENT_RAW_SIZE_MB * 1024 * 1024) {
      return `Chaque image doit faire moins de ${MAX_ATTACHMENT_RAW_SIZE_MB} Mo.`;
    }
  }
  return null;
}

async function uploadMessageAttachment(conversationId: string, messageId: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${conversationId}/${messageId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("message-attachments").upload(path, file, { upsert: false });
  return error ? null : path;
}

/** URL signée (1h) pour consulter une pièce jointe de message. */
export async function getMessageAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Récupère les infos d'une conversation (annonce + interlocuteur). */
/** Récupère les infos d'une conversation : annonce reliée + interlocuteur. */
export async function getConversation(conversationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, owner_id, listing:listings(id, title, price, image_url, neighborhood, city, status), tenant:profiles!conversations_tenant_id_fkey(full_name, city, verification, created_at, avatar_url), owner:profiles!conversations_owner_id_fkey(full_name, city, verification, created_at, avatar_url)"
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return null;

  const listing = Array.isArray(data.listing) ? data.listing[0] : data.listing;
  const tenant = Array.isArray(data.tenant) ? data.tenant[0] : data.tenant;
  const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner;

  // L'interlocuteur, c'est l'autre personne que moi
  const iAmOwner = data.owner_id === user.id;
  const other = iAmOwner ? tenant : owner;

  return {
    id: data.id,
    myId: user.id,
    listing: {
      id: listing?.id ?? "",
      title: listing?.title ?? "Annonce",
      price: listing?.price ?? 0,
      image: listing?.image_url ?? null,
      location: [listing?.neighborhood, listing?.city].filter(Boolean).join(", "),
      available: listing?.status === "publiee",
      status: listing?.status ?? null,
    },
    other: {
      id: iAmOwner ? data.tenant_id : data.owner_id,
      name: other?.full_name ?? "Utilisateur",
      city: other?.city ?? null,
      verified: other?.verification === "verifie",
      memberSince: other?.created_at ?? null,
      avatar: other?.avatar_url ?? null,
    },
    otherIsOwner: !iAmOwner,
  };
}

export interface MessageAttachment {
  id: string;
  storagePath: string;
}

export interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
  attachments: MessageAttachment[];
}

/** Récupère les messages d'une conversation, du plus ancien au plus récent, pièces jointes incluses. */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const messageIds = data.map((m) => m.id);
  const { data: attRows } =
    messageIds.length > 0
      ? await supabase.from("message_attachments").select("id, message_id, storage_path").in("message_id", messageIds)
      : { data: [] as { id: string; message_id: string; storage_path: string }[] };

  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  for (const a of attRows ?? []) {
    const list = attachmentsByMessage.get(a.message_id) ?? [];
    list.push({ id: a.id, storagePath: a.storage_path });
    attachmentsByMessage.set(a.message_id, list);
  }

  return data.map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.sender_id,
    createdAt: m.created_at,
    readAt: m.read_at,
    attachments: attachmentsByMessage.get(m.id) ?? [],
  }));
}

/** Envoie un message dans une conversation, avec pièces jointes (images) éventuelles. */
export async function sendMessage(
  conversationId: string,
  body: string,
  files: File[] = []
): Promise<{ success?: boolean; error?: string }> {
  const trimmed = body.trim();

  const validationError = validateMessageAttachments(files, trimmed.length > 0);
  if (validationError) return { error: validationError };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    })
    .select("id")
    .single();

  if (error || !data) return { error: friendlyErrorMessage(error!, "Impossible d'envoyer le message. Réessayez.") };

  if (files.length > 0) {
    const compressed = await compressImages(files);
    for (const file of compressed) {
      const path = await uploadMessageAttachment(conversationId, data.id, file);
      if (path) {
        await supabase.from("message_attachments").insert({ message_id: data.id, storage_path: path });
      }
    }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return { success: true };
}


/** Liste les conversations de l'utilisateur (locataire ou bailleur), plus récentes d'abord. */
export interface ConversationSummary {
  id: string;
  listingTitle: string;
  listingImage: string | null;
  lastMessageAt: string;
  role: "bailleur" | "locataire";
  unread: number;
}

/** Liste les conversations de l'utilisateur, avec le nombre de messages non lus. */
export async function getMyConversations(): Promise<ConversationSummary[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, owner_id, last_message_at, listing:listings(title, image_url), messages(sender_id, read_at)"
    )
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((c) => {
    const listing = Array.isArray(c.listing) ? c.listing[0] : c.listing;
    const msgs = (c.messages ?? []) as { sender_id: string; read_at: string | null }[];
    // Non lus = messages reçus (pas de moi) et non encore lus
    const unread = msgs.filter((m) => m.sender_id !== user.id && m.read_at === null).length;

    return {
      id: c.id,
      listingTitle: listing?.title ?? "Annonce",
      listingImage: listing?.image_url ?? null,
      lastMessageAt: c.last_message_at,
      role: c.owner_id === user.id ? "bailleur" : "locataire",
      unread,
    };
  });
}

/** Marque comme lus tous les messages reçus dans une conversation. */
export async function markConversationRead(conversationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}

/** Compte le nombre total de conversations ayant au moins un message non lu. */
export async function countUnreadConversations(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, messages(sender_id, read_at)")
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`);

  if (error || !data) return 0;

  return data.filter((c) => {
    const msgs = (c.messages ?? []) as { sender_id: string; read_at: string | null }[];
    return msgs.some((m) => m.sender_id !== user.id && m.read_at === null);
  }).length;
}