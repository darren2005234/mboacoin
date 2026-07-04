"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { getMyConversations, type ConversationSummary } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setConversations(await getMyConversations());
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Messages" />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <p className="text-sm font-bold">Aucune conversation</p>
          <p className="text-sm text-muted-foreground">
            Contactez un bailleur depuis une annonce pour démarrer une discussion.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => router.push(`/messages/${c.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {c.listingImage && (
                    <Image src={c.listingImage} alt="" fill className="object-cover" sizes="48px" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={
                        c.unread > 0
                          ? "line-clamp-1 text-sm font-extrabold text-foreground"
                          : "line-clamp-1 text-sm font-bold text-foreground"
                      }
                    >
                      {c.listingTitle}
                    </p>
                    {c.unread > 0 && (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <span
                    className={
                      c.role === "bailleur"
                        ? "mt-0.5 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-primary"
                        : "mt-0.5 inline-block rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground"
                    }
                  >
                    {c.role === "bailleur" ? "Vous êtes le bailleur" : "Vous louez"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}