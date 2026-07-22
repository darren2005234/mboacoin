"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getLeasesScheduleStatus, getLeasePaymentAmountsForPeriod } from "@/lib/lease-payments";
import { monthPeriod } from "@/lib/lease-schedule";
import { summarizeLeaseFinances, buildLateLeaseList, type FinanceSummary, type LateLeaseEntry } from "@/lib/lease-finance-summary";
import { useRequireAuth } from "@/lib/use-require-auth";

const selectCls =
  "rounded-full border border-input bg-card px-3 py-2 text-xs font-semibold outline-none focus:border-accent";

export default function LeaseFinancesPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [offset, setOffset] = useState<0 | -1>(0);
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>({
    expected: 0, collected: 0, missing: 0, advanceActiveCount: 0, advanceEarliestCoverageEnd: null,
  });
  const [lateLeases, setLateLeases] = useState<LateLeaseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    getMyLeases().then(async (data) => {
      setLeases(data);
      const active = data.filter((l) => l.status === "actif");
      const period = monthPeriod(offset);
      const [scheduleStatus, collectedByLease] = await Promise.all([
        getLeasesScheduleStatus(active),
        getLeasePaymentAmountsForPeriod(active.map((l) => l.id), period),
      ]);
      setSummary(summarizeLeaseFinances(period, active, collectedByLease));
      setLateLeases(buildLateLeaseList(active, scheduleStatus));
      setLoading(false);
    });
  }, [ready, offset]);

  const advanceLeases = leases.filter((l) => l.status === "actif" && l.paymentMode === "avance");

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Synthèse financière" subtitle="Perçu, attendu et retards, pour un mois donné." />

      <div className="flex gap-2 px-5 pb-4">
        <select
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value) as 0 | -1)}
          className={selectCls}
        >
          <option value={0}>Mois en cours</option>
          <option value={-1}>Mois précédent</option>
        </select>
      </div>

      {!ready || loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-6 px-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <Price amount={summary.collected} size="md" />
              <p className="mt-1 text-xs text-muted-foreground">Perçu</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <Price amount={summary.expected} size="md" />
              <p className="mt-1 text-xs text-muted-foreground">Attendu</p>
            </div>
            <div className={`rounded-2xl border p-3 shadow-card ${summary.missing > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
              <Price amount={summary.missing} size="md" className={summary.missing > 0 ? "text-destructive" : undefined} />
              <p className="mt-1 text-xs text-muted-foreground">Manquant</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold">
              Baux en retard {lateLeases.length > 0 && `(${lateLeases.length})`}
            </p>
            {lateLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun bail mensuel en retard.</p>
            ) : (
              <div className="space-y-2">
                {lateLeases.map((l) => (
                  <button
                    key={l.leaseId}
                    onClick={() => router.push(`/my-leases/${l.leaseId}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-bold">{l.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.tenantName ?? "Locataire non rattaché"} · en retard depuis {l.daysLate} jour{l.daysLate > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Price amount={l.amount} size="sm" className="shrink-0 text-destructive" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {advanceLeases.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold">
                Baux en avance ({advanceLeases.length})
              </p>
              <p className="text-xs text-muted-foreground">
                Loyer payé d&apos;avance : pas d&apos;échéance mensuelle, jamais de retard possible.
              </p>
              <div className="space-y-2">
                {advanceLeases.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => router.push(`/my-leases/${l.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-card"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-bold">{l.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">{l.tenantName ?? "Locataire non rattaché"}</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {l.endDate ? `Couvert jusqu'au ${new Date(l.endDate).toLocaleDateString("fr-FR")}` : "—"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
