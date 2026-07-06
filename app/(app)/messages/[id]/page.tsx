"use client";

import { Icon } from "@/components/mboacoin/icon";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  type Message,
} from "@/lib/messages";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Avatar } from "@/components/mboacoin/avatar";

const SUGGESTIONS = [
  "Bonjour, ce logement est-il toujours disponible ?",
  "J'aimerais organiser une visite, quelles sont vos disponibilités ?",
  "Quelles sont les conditions (avance, caution) ?",
  "Le prix est-il négociable ?",
];

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  type ConvInfo = Awaited<ReturnType<typeof getConversation>>;
  const [info, setInfo] = useState<ConvInfo>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const conv = await getConversation(id);
      if (!conv) {
        router.push("/messages");
        return;
      }
      setInfo(conv);
      setMessages(await getMessages(id));
      await markConversationRead(id);
      setLoading(false);
    })();

    // Abonnement temps réel : nouveaux messages ET mises à jour (lecture)
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const m = payload.new as {
            id: string;
            body: string;
            sender_id: string;
            created_at: string;
            read_at: string | null;
          };
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                body: m.body,
                senderId: m.sender_id,
                createdAt: m.created_at,
                readAt: m.read_at ?? null,
              },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const m = payload.new as { id: string; read_at: string | null };
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, readAt: m.read_at } : x))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, router]);

  // Marque comme lu dès qu'il y a des messages reçus non lus (fiable, après mise à jour de l'état)
  useEffect(() => {
    if (loading || !info) return;
    const hasUnreadReceived = messages.some(
      (m) => m.senderId !== info.myId && m.readAt === null
    );
    if (hasUnreadReceived) {
      markConversationRead(id);
    }
  }, [messages, info, loading, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    await sendMessage(id, body);
    setMessages(await getMessages(id));
  }

  async function sendSuggestion(suggestion: string) {
    await sendMessage(id, suggestion);
    setMessages(await getMessages(id));
  }

  return (
    <div className="flex h-full flex-col">
      {/* En-tête : interlocuteur */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/messages" aria-label="Retour" className="shrink-0 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar name={info?.other.name ?? "?"} src={info?.other.avatar ?? null} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="line-clamp-1 text-sm font-bold">{info?.other.name ?? "Conversation"}</p>
            {info?.other.verified && <Icon name="verified" size={15} className="text-seal" />}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {info?.otherIsOwner ? "Bailleur" : "Locataire"}
            {info?.other.memberSince
              ? ` · Membre depuis ${new Date(info.other.memberSince).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
              : ""}
          </p>
        </div>
      </header>

      {/* Encart annonce reliée */}
      {info?.listing && (
        <Link
          href={`/listings/${info.listing.id}`}
          className="relative flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2.5"
        >
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {info.listing.image && (
              <Image
                src={info.listing.image}
                alt=""
                fill
                className={`object-cover ${!info.listing.available ? "opacity-40 grayscale" : ""}`}
                sizes="44px"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`line-clamp-1 text-xs font-bold ${!info.listing.available ? "text-muted-foreground" : ""}`}>
              {info.listing.title}
            </p>
            {info.listing.available ? (
              <p className="text-[11px] text-muted-foreground">{info.listing.location}</p>
            ) : (
              <p className="text-[11px] font-semibold text-pending-text">
                {info.otherIsOwner
                  ? "Cette annonce n'est plus disponible"
                  : "Vous avez marqué cette annonce comme louée"}
              </p>
            )}
          </div>
          {info.listing.available && (
            <p className="shrink-0 font-mono text-xs font-bold text-primary">
              {new Intl.NumberFormat("fr-FR").format(info.listing.price)} F
            </p>
          )}
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Chargement...</p>
        ) : messages.length === 0 ? (
          <div className="space-y-4 py-6">
            <p className="text-center text-sm text-muted-foreground">
              Démarrez la conversation
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendSuggestion(s)}
                  className="block w-full rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-accent hover:bg-brand-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === info?.myId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-foreground"
                  )}
                >
                  <span>{m.body}</span>
                  {mine && (
                    <span className="ml-2 inline-flex translate-y-0.5 items-center">
                      <Icon
                        name={m.readAt ? "done_all" : "done"}
                        size={15}
                        className={m.readAt ? "text-brand-200" : "text-primary-foreground/60"}
                      />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Saisie */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Votre message..."
          className="flex-1 rounded-full border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          aria-label="Envoyer"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-5" />
        </button>
      </div>
    </div>
  );
}