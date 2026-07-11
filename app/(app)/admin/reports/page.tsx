"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import {
  getPendingReports,
  markReportHandled,
  dismissReport,
  suspendReportedListing,
  type PendingReport,
} from "@/lib/admin-reports";

export default function AdminReportsPage() {
  const [items, setItems] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setItems(await getPendingReports());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handle(item: PendingReport) {
    setBusy(item.id);
    await markReportHandled(item.id);
    await refresh();
    setBusy(null);
  }

  async function dismiss(item: PendingReport) {
    setBusy(item.id);
    await dismissReport(item.id);
    await refresh();
    setBusy(null);
  }

  async function suspend(item: PendingReport) {
    setBusy(item.id);
    await suspendReportedListing(item.id, item.targetId);
    await refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Signalements" subtitle="Annonces et utilisateurs signalés en attente." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-bg">
            <Icon name="check_circle" size={28} className="text-ok-text" />
          </span>
          <p className="text-sm font-bold">Aucun signalement en attente</p>
        </div>
      ) : (
        <div className="space-y-4 px-5">
          {items.map((item) => (
            <div key={item.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    name={item.targetType === "listing" ? "apartment" : "person"}
                    size={18}
                    className="text-muted-foreground"
                  />
                  <div>
                    <p className="text-sm font-bold">{item.targetLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.targetType === "listing" ? "Annonce signalée" : "Utilisateur signalé"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>

              <a
                href={item.targetType === "listing" ? `/listings/${item.targetId}` : `/users/${item.targetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-accent underline"
              >
                <Icon name="open_in_new" size={14} /> Voir la cible du signalement
              </a>

              <div className="rounded-xl bg-secondary/50 p-3">
                <p className="text-sm font-bold">{item.reason}</p>
                {item.details && <p className="mt-1 text-xs text-muted-foreground">{item.details}</p>}
                <p className="mt-1 text-xs text-muted-foreground">Signalé par {item.reporterName}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {item.targetType === "listing" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => suspend(item)}
                    disabled={busy === item.id}
                  >
                    <Icon name="block" size={16} /> Suspendre l&apos;annonce
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => dismiss(item)} disabled={busy === item.id}>
                  <Icon name="close" size={16} /> Non fondé
                </Button>
                <Button size="sm" onClick={() => handle(item)} disabled={busy === item.id}>
                  <Icon name="check" size={16} /> Traiter
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
