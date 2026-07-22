"use client";

import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";
import { Price } from "@/components/mboacoin/price";
import type { FinanceSummary, LateLeaseEntry } from "@/lib/lease-finance-summary";

/**
 * Encart partagé par MyLeasesToolbar (liste plate ET vue par résidence) :
 * la synthèse doit être identique dans les deux contextes, jamais dupliquée
 * ni recalculée différemment (voir my-leases-toolbar.tsx).
 */
export function LeaseFinanceSummaryCard({
  summary,
  lateLeases,
}: {
  summary: FinanceSummary;
  lateLeases: LateLeaseEntry[];
}) {
  return (
    <Link
      href="/my-leases/finances"
      className="mx-5 mb-4 block rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">Ce mois-ci</p>
        <Icon name="chevron_right" size={18} className="text-muted-foreground" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-secondary py-2.5">
          <Price amount={summary.collected} size="sm" />
          <p className="text-[10px] text-muted-foreground">Perçu</p>
        </div>
        <div className="rounded-xl bg-secondary py-2.5">
          <Price amount={summary.expected} size="sm" />
          <p className="text-[10px] text-muted-foreground">Attendu</p>
        </div>
        <div className={`rounded-xl py-2.5 ${summary.missing > 0 ? "bg-destructive/10" : "bg-secondary"}`}>
          <Price amount={summary.missing} size="sm" className={summary.missing > 0 ? "text-destructive" : undefined} />
          <p className="text-[10px] text-muted-foreground">Manquant</p>
        </div>
      </div>

      {(lateLeases.length > 0 || summary.advanceActiveCount > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {lateLeases.length > 0 && (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              {lateLeases.length} bail{lateLeases.length > 1 ? "aux" : ""} en retard
            </span>
          )}
          {summary.advanceActiveCount > 0 && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {summary.advanceActiveCount} en avance
              {summary.advanceEarliestCoverageEnd &&
                ` · couvert${summary.advanceActiveCount > 1 ? "s" : ""} jusqu'au ${new Date(
                  summary.advanceEarliestCoverageEnd
                ).toLocaleDateString("fr-FR")}`}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
