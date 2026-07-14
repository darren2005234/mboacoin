"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { SupportThread } from "@/components/mboacoin/support-thread";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";
import { getSupportTicketThread, sendSupportMessage, type SupportTicketThread } from "@/lib/support";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function MySupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useRequireAuth();
  const [thread, setThread] = useState<SupportTicketThread | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const t = await getSupportTicketThread(id);
    if (!t) {
      setNotFound(true);
    } else {
      setThread(t);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  if (!ready || loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (notFound || !thread) {
    return (
      <div className="flex flex-col pb-8">
        <Link href="/support" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <ScreenHeader title="Ticket introuvable" />
        <p className="px-5 text-sm text-muted-foreground">Ce ticket n&apos;existe pas ou ne vous appartient pas.</p>
      </div>
    );
  }

  const closed = thread.ticket.status === "resolu" || thread.ticket.status === "ferme";

  return (
    <div className="flex flex-col pb-8">
      <Link href="/support" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader
        title={thread.ticket.subject}
        subtitle={`${SUPPORT_CATEGORY_LABELS[thread.ticket.category]} · ${SUPPORT_STATUS_LABELS[thread.ticket.status]}`}
      />

      <div className="px-5">
        <SupportThread
          description={thread.ticket.description}
          descriptionAttachments={thread.ticketAttachments}
          messages={thread.messages}
          disabled={false}
          onSendMessage={async (body, files) => {
            const result = await sendSupportMessage(thread.ticket.id, thread.ticket.followUpToken, body, files);
            if (!result.error) await refresh();
            return result;
          }}
        />
        {closed && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Ce ticket est {thread.ticket.status === "resolu" ? "résolu" : "fermé"}. Écrire un message le rouvre.
          </p>
        )}
      </div>
    </div>
  );
}
