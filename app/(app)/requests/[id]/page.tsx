"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getLeaseRequestThread,
  sendLeaseRequestMessage,
  updateLeaseRequestStatus,
  getAttachmentSignedUrl,
  REQUEST_TYPE_LABELS,
  type LeaseRequestThread,
} from "@/lib/lease-requests";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function LeaseRequestThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();

  const [myId, setMyId] = useState<string | null>(null);
  const [thread, setThread] = useState<LeaseRequestThread | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const data = await getLeaseRequestThread(id);
    if (!data) {
      router.push("/explore");
      return;
    }
    setThread(data);

    const allAttachments = [
      ...data.requestAttachments,
      ...data.messages.flatMap((m) => m.attachments),
    ];
    const entries = await Promise.all(
      allAttachments.map(async (a) => [a.id, await getAttachmentSignedUrl(a.storagePath)] as const)
    );
    setUrls(Object.fromEntries(entries.filter(([, url]) => url) as [string, string][]));
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));

    refresh();

    const channel = supabase
      .channel(`lease-request:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lease_request_messages", filter: `request_id=eq.${id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lease_request_attachments", filter: `request_id=eq.${id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lease_requests", filter: `id=eq.${id}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 5);
    setPendingFiles(picked);
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    const files = pendingFiles;
    setPendingFiles([]);
    const result = await sendLeaseRequestMessage(id, body, files);
    if (result.error) setError(result.error);
    await refresh();
    setSending(false);
  }

  async function changeStatus(status: string) {
    setError(null);
    setStatusBusy(true);
    const result = await updateLeaseRequestStatus(id, status);
    if (result.error) setError(result.error);
    await refresh();
    setStatusBusy(false);
  }

  if (loading || !thread) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  const { request } = thread;
  const isLandlord = myId === request.landlordId;
  const isTenant = myId === request.tenantId;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <button onClick={() => router.back()} aria-label="Retour" className="mt-0.5 shrink-0 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="line-clamp-1 text-sm font-bold">{request.subject}</p>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {REQUEST_TYPE_LABELS[request.type] ?? request.type} · {request.listingTitle}
          </p>
        </div>
      </header>

      {/* Description initiale + pièces jointes */}
      <div className="space-y-2 border-b border-border bg-secondary/40 px-4 py-3">
        <p className="text-sm">{request.description}</p>
        {thread.requestAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {thread.requestAttachments.map((a) =>
              urls[a.id] ? (
                <a key={a.id} href={urls[a.id]} target="_blank" rel="noopener noreferrer">
                  <img src={urls[a.id]} alt="" className="size-16 rounded-lg object-cover" />
                </a>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Actions de statut, selon le rôle */}
      {(isLandlord || isTenant) && (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5">
          {isLandlord && request.status === "nouvelle" && (
            <button
              onClick={() => changeStatus("en_cours")}
              disabled={statusBusy}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              Prendre en charge
            </button>
          )}
          {isLandlord && (request.status === "nouvelle" || request.status === "en_cours") && (
            <>
              <button
                onClick={() => changeStatus("resolue")}
                disabled={statusBusy}
                className="rounded-full bg-ok-bg px-3 py-1.5 text-xs font-bold text-ok-text disabled:opacity-50"
              >
                Marquer résolue
              </button>
              <button
                onClick={() => changeStatus("fermee")}
                disabled={statusBusy}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-50"
              >
                Fermer
              </button>
            </>
          )}
          {isTenant && request.status === "resolue" && (
            <button
              onClick={() => changeStatus("nouvelle")}
              disabled={statusBusy}
              className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50"
            >
              Rouvrir la demande
            </button>
          )}
        </div>
      )}

      {/* Fil de messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {thread.messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Aucun échange pour l&apos;instant</p>
        ) : (
          thread.messages.map((m) => {
            const mine = m.senderId === myId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] space-y-2 rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-foreground"
                  )}
                >
                  <span>{m.body}</span>
                  {m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.attachments.map((a) =>
                        urls[a.id] ? (
                          <a key={a.id} href={urls[a.id]} target="_blank" rel="noopener noreferrer">
                            <img src={urls[a.id]} alt="" className="size-16 rounded-lg object-cover" />
                          </a>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-center text-xs font-medium text-destructive">{error}</p>}

      {/* Saisie */}
      <div className="space-y-2 border-t border-border p-3">
        {pendingFiles.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground">{pendingFiles.length} photo(s) prête(s) à envoyer</p>
        )}
        <div className="flex items-center gap-2">
          <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-muted-foreground">
            <Camera className="size-5" />
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPickPhoto} className="hidden" />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Votre message..."
            className="flex-1 rounded-full border border-input bg-card px-4 py-2.5 text-[15px] outline-none focus:border-accent"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Envoyer"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    nouvelle: { label: "Nouvelle", cls: "bg-pending-bg text-pending-text" },
    en_cours: { label: "En cours", cls: "bg-pending-bg text-pending-text" },
    resolue: { label: "Résolue", cls: "bg-ok-bg text-ok-text" },
    fermee: { label: "Fermée", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? map.nouvelle;
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
