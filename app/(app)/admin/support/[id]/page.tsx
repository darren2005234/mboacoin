"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { SupportThread } from "@/components/mboacoin/support-thread";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";
import {
  getSupportTicketDetail,
  replyToSupportTicket,
  updateSupportTicketStatus,
  type AdminSupportTicketThread,
} from "@/lib/admin-support";

const STATUSES = ["nouveau", "en_cours", "resolu", "ferme"] as const;

export default function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thread, setThread] = useState<AdminSupportTicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStatus, setBusyStatus] = useState(false);

  async function refresh() {
    setThread(await getSupportTicketDetail(id));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(status: string) {
    setBusyStatus(true);
    await updateSupportTicketStatus(id, status);
    await refresh();
    setBusyStatus(false);
  }

  if (loading || !thread) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  const { ticket } = thread;
  const ctx = ticket.requesterContext;

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin/support" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title={ticket.subject} subtitle={SUPPORT_CATEGORY_LABELS[ticket.category]} />

      <div className="space-y-4 px-5">
        {/* Statut */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="text-xs font-semibold text-muted-foreground">Statut</span>
          <select
            value={ticket.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={busyStatus}
            className="ml-auto rounded-full border border-input bg-card px-3 py-1.5 text-xs font-bold outline-none focus:border-accent"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUPPORT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Contexte du demandeur */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Demandeur</p>
          {ctx ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Nom" value={ctx.fullName ?? "—"} />
              <Info
                label="Vérification"
                value={
                  ctx.verification === "verifie"
                    ? "Vérifié"
                    : ctx.verification === "en_attente"
                      ? "En attente"
                      : "Non vérifié"
                }
              />
              <Info label="Type de compte" value={ctx.accountType} />
              <Info label="Annonces" value={String(ctx.listingCount)} />
              <Info label="Baux (bailleur)" value={String(ctx.landlordLeaseCount)} />
              <Info label="Baux (locataire)" value={String(ctx.tenantLeaseCount)} />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold">Visiteur non connecté</p>
              {ticket.contactEmail && <p>Email : {ticket.contactEmail}</p>}
              {ticket.contactPhone && <p>Téléphone : {ticket.contactPhone}</p>}
            </div>
          )}
        </div>

        {/* Fil */}
        <SupportThread
          description={ticket.description}
          descriptionAttachments={thread.ticketAttachments}
          messages={thread.messages}
          allowAttachments={false}
          onSendMessage={async (body) => {
            const result = await replyToSupportTicket(id, body);
            if (!result.error) await refresh();
            return result;
          }}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold capitalize">{value}</p>
    </div>
  );
}
