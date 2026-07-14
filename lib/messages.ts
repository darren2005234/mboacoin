import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/supabase-error";

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
      name: other?.full_name ?? "Utilisateur",
      city: other?.city ?? null,
      verified: other?.verification === "verifie",
      memberSince: other?.created_at ?? null,
      avatar: other?.avatar_url ?? null,
    },
    otherIsOwner: !iAmOwner,
  };
}

export interface Message {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

/** Récupère les messages d'une conversation, du plus ancien au plus récent. */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.sender_id,
    createdAt: m.created_at,
    readAt: m.read_at,
  }));
}

/** Envoie un message dans une conversation. */
export async function sendMessage(conversationId: string, body: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: body.trim(),
  });

  if (error) return { error: friendlyErrorMessage(error, "Impossible d'envoyer le message. Réessayez.") };

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