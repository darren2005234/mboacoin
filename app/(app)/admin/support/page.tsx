"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";
import { getSupportTickets, type AdminSupportTicketSummary } from "@/lib/admin-support";

const STATUSES = ["nouveau", "en_cours", "resolu", "ferme"] as const;

const STATUS_CLS: Record<string, string> = {
  nouveau: "bg-pending-bg text-pending-text",
  en_cours: "bg-pending-bg text-pending-text",
  resolu: "bg-ok-bg text-ok-text",
  ferme: "bg-secondary text-muted-foreground",
};

const selectCls =
  "rounded-full border border-input bg-card px-3 py-2 text-xs font-semibold outline-none focus:border-accent";

export default function AdminSupportPage() {
  const [items, setItems] = useState<AdminSupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  async function refresh() {
    setLoading(true);
    setItems(await getSupportTickets({ category: category || undefined, status: status || undefined }));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Support" subtitle="Demandes des utilisateurs et visiteurs." />

      <div className="flex gap-2 px-5 pb-4">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">Toutes catégories</option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPORT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUPPORT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-bg">
            <Icon name="check_circle" size={28} className="text-ok-text" />
          </span>
          <p className="text-sm font-bold">Aucun ticket</p>
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {items.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className={`block rounded-2xl border p-4 shadow-card ${
                t.status === "nouveau" ? "border-accent/40 bg-accent/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-sm font-bold">{t.subject}</p>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[t.status]}`}>
                  {SUPPORT_STATUS_LABELS[t.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {SUPPORT_CATEGORY_LABELS[t.category]} · {t.requesterName ?? "Visiteur"}
                {t.isVisitor && " (visiteur)"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
