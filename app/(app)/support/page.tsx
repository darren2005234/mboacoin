"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { SupportTicketForm } from "@/components/mboacoin/support-ticket-form";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";
import {
  createSupportTicket,
  getMySupportTickets,
  type CreateSupportTicketInput,
  type SupportTicketSummary,
} from "@/lib/support";
import { createClient } from "@/lib/supabase/client";

const STATUS_CLS: Record<string, string> = {
  nouveau: "bg-pending-bg text-pending-text",
  en_cours: "bg-pending-bg text-pending-text",
  resolu: "bg-ok-bg text-ok-text",
  ferme: "bg-secondary text-muted-foreground",
};

export default function SupportPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [connected, setConnected] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setConnected(Boolean(user));
      setCheckingAuth(false);
      if (user) {
        setTickets(await getMySupportTickets());
      }
      setLoadingTickets(false);
    });
  }, []);

  async function submit(input: CreateSupportTicketInput) {
    setBusy(true);
    setError(null);
    const result = await createSupportTicket(input);
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    if (connected && result.id) {
      router.push(`/support/${result.id}`);
    } else if (result.followUpToken) {
      router.push(`/support/suivi/${result.followUpToken}`);
    }
  }

  if (checkingAuth) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  const showFormNow = !connected || showForm || (!loadingTickets && tickets.length === 0);

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader
        title="Aide et support"
        subtitle="Un problème d'accès, de vérification, de paiement ou une arnaque à signaler ? Écrivez-nous."
      />

      <div className="space-y-4 px-5">
        {connected && !loadingTickets && tickets.length > 0 && !showFormNow && (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
            >
              <Icon name="add" size={18} /> Nouveau ticket
            </button>
            <div className="space-y-3">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/support/${t.id}`}
                  className="block rounded-2xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{t.subject}</p>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[t.status]}`}>
                      {SUPPORT_STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{SUPPORT_CATEGORY_LABELS[t.category]}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {showFormNow && (
          <>
            {connected && tickets.length > 0 && (
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-bold text-accent underline"
              >
                Retour à mes tickets
              </button>
            )}
            <SupportTicketForm requireContact={!connected} busy={busy} error={error} onSubmit={submit} />
          </>
        )}
      </div>
    </div>
  );
}
