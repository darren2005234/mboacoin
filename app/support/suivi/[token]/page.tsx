"use client";

import { use, useEffect, useState } from "react";
import { Logo } from "@/components/mboacoin/logo";
import { Icon } from "@/components/mboacoin/icon";
import { SupportThread } from "@/components/mboacoin/support-thread";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";
import {
  getSupportTicketByToken,
  getSupportTicketThreadByToken,
  addSupportTicketMessageByToken,
  type SupportTicketDetail,
  type SupportThreadMessage,
  type SupportAttachment,
} from "@/lib/support";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SupportFollowUpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportThreadMessage[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  async function refresh() {
    if (!UUID_RE.test(token)) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    const t = await getSupportTicketByToken(token);
    if (!t) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    const thread = await getSupportTicketThreadByToken(token);
    setTicket(t);
    setMessages(thread.messages);
    setTicketAttachments(thread.ticketAttachments);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={48} />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-foreground">Mboa</span>
            <span className="text-primary">Coin</span>
          </span>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Chargement...</p>
        ) : invalid || !ticket ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <Icon name="cancel" size={26} />
            </span>
            <p className="mt-3 text-base font-bold">Lien de suivi invalide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ce lien ne correspond à aucune demande. Vérifiez que vous avez copié l&apos;adresse complète.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
              <p className="text-sm font-bold">{ticket.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {SUPPORT_CATEGORY_LABELS[ticket.category]} · {SUPPORT_STATUS_LABELS[ticket.status]}
              </p>
            </div>

            <SupportThread
              description={ticket.description}
              descriptionAttachments={ticketAttachments}
              messages={messages}
              onSendMessage={async (body, files) => {
                const result = await addSupportTicketMessageByToken(token, body, files);
                if (!result.error) await refresh();
                return result;
              }}
            />

            <p className="text-center text-[11px] text-muted-foreground">
              Gardez ce lien précieusement : c&apos;est le seul moyen de suivre votre demande.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
