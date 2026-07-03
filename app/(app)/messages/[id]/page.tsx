"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getConversation,
  getMessages,
  sendMessage,
  type Message,
} from "@/lib/messages";
import { cn } from "@/lib/utils";
import { markConversationRead } from "@/lib/messages";

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
  const [info, setInfo] = useState<{ myId: string; listingTitle: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const conv = await getConversation(id);
      await markConversationRead(id);
      if (!conv) {
        router.push("/messages");
        return;
      }
      setInfo({ myId: conv.myId, listingTitle: conv.listingTitle });
      setMessages(await getMessages(id));
      setLoading(false);
    })();

    // Abonnement temps réel : on écoute les nouveaux messages de cette conversation
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
          };
          setMessages((prev) => {
            // Évite les doublons (si le message est déjà là)
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, { id: m.id, body: m.body, senderId: m.sender_id, createdAt: m.created_at }];
          });
        }
      )
      .subscribe();

    // Nettoyage : on se désabonne en quittant la conversation
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, router]);

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
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/messages" aria-label="Retour" className="text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <p className="line-clamp-1 text-sm font-bold">
          {info?.listingTitle ?? "Conversation"}
        </p>
      </header>

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
                  {m.body}
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