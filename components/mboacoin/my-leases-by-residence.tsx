"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { MyLeasesToolbar } from "@/components/mboacoin/my-leases-toolbar";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getMyResidences, type Residence } from "@/lib/residences";
import { getMyListings, type MyListing } from "@/lib/my-listings";
import { getLeasesScheduleStatus, getLeasePaymentAmountsForPeriod, type LeaseScheduleStatus } from "@/lib/lease-payments";
import { getRenewalIntentsForLeases, type LeaseRenewalIntent } from "@/lib/lease-renewal-intent";
import { countNewLeaseRequestsForLandlord } from "@/lib/lease-requests";
import { monthPeriod } from "@/lib/lease-schedule";
import { summarizeLeaseFinances, buildLateLeaseList, type FinanceSummary, type LateLeaseEntry } from "@/lib/lease-finance-summary";
import { summarizeLeasesByResidence, type ResidenceLeaseSummary } from "@/lib/residence-lease-summary";
import { useRequireAuth } from "@/lib/use-require-auth";

/** Espace "Mes baux" organisé par résidence — comptes résidence uniquement. */
export function MyLeasesByResidence() {
  const { ready } = useRequireAuth();
  const [optIn] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("opt_in") : null
  );
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [summaries, setSummaries] = useState<ResidenceLeaseSummary[]>([]);
  const [newRequests, setNewRequests] = useState(0);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary>({
    expected: 0, collected: 0, missing: 0, advanceActiveCount: 0, advanceEarliestCoverageEnd: null,
  });
  const [lateLeases, setLateLeases] = useState<LateLeaseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    Promise.all([getMyLeases(), getMyResidences(), getMyListings()]).then(
      async ([leaseRows, residences, listings]: [MyLease[], Residence[], MyListing[]]) => {
        setLeases(leaseRows);
        setLoading(false);
        const active = leaseRows.filter((l) => l.status === "actif");
        const period = monthPeriod(0);
        const [scheduleStatus, renewalIntents, collectedByLease]: [
          Record<string, LeaseScheduleStatus>,
          Record<string, LeaseRenewalIntent>,
          Map<string, number>,
        ] = await Promise.all([
          getLeasesScheduleStatus(active),
          getRenewalIntentsForLeases(active.filter((l) => l.paymentMode === "avance").map((l) => l.id)),
          getLeasePaymentAmountsForPeriod(active.map((l) => l.id), period),
        ]);
        setSummaries(summarizeLeasesByResidence(residences, listings, leaseRows, scheduleStatus, renewalIntents));
        setFinanceSummary(summarizeLeaseFinances(period, active, collectedByLease));
        setLateLeases(buildLateLeaseList(active, scheduleStatus));
      }
    );
    countNewLeaseRequestsForLandlord().then(setNewRequests);
  }, [ready]);

  if (!ready) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes baux" />

      <MyLeasesToolbar
        optIn={optIn}
        newRequests={newRequests}
        hasAdvanceLease={leases.some((l) => l.paymentMode === "avance")}
        financeSummary={financeSummary}
        lateLeases={lateLeases}
      />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : summaries.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Créez une résidence pour organiser vos baux
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {summaries.map((s) => (
            <ResidenceSummaryCard key={s.residenceId ?? "isoles"} summary={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResidenceSummaryCard({ summary }: { summary: ResidenceLeaseSummary }) {
  const drillHref = `/my-leases/residence/${summary.residenceId ?? "isoles"}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Link href={drillHref} className="block">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">{summary.name}</p>
          <Icon name="chevron_right" size={18} className="text-muted-foreground" />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {summary.totalLogements} logement{summary.totalLogements > 1 ? "s" : ""}
        </p>

        {summary.totalLogements > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Loués" value={summary.loues} />
            <Stat label="Disponibles" value={summary.disponibles} />
            <Stat label="Hors marché" value={summary.horsMarche} />
          </div>
        )}

        {(summary.enAttente > 0 ||
          summary.enRetard > 0 ||
          summary.bientotEchueReste > 0 ||
          summary.bientotEchuePart > 0 ||
          summary.bientotEchueSansReponse > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {summary.enAttente > 0 && (
              <span className="rounded-md bg-pending-bg px-2 py-0.5 text-[10px] font-bold text-pending-text">
                {summary.enAttente} en attente de confirmation
              </span>
            )}
            {summary.enRetard > 0 && (
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                {summary.enRetard} en retard
              </span>
            )}
            {summary.bientotEchueSansReponse > 0 && (
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                {summary.bientotEchueSansReponse} sans réponse (couverture bientôt échue)
              </span>
            )}
            {summary.bientotEchuePart > 0 && (
              <span className="rounded-md bg-pending-bg px-2 py-0.5 text-[10px] font-bold text-pending-text">
                {summary.bientotEchuePart} part{summary.bientotEchuePart > 1 ? "ent" : ""} à l&apos;échéance
              </span>
            )}
            {summary.bientotEchueReste > 0 && (
              <span className="rounded-md bg-ok-bg px-2 py-0.5 text-[10px] font-bold text-ok-text">
                {summary.bientotEchueReste} reste{summary.bientotEchueReste > 1 ? "nt" : ""} (à renouveler)
              </span>
            )}
          </div>
        )}
      </Link>

      {summary.totalLogements === 0 && summary.residenceId && (
        <Link
          href={`/publish?residence=${summary.residenceId}`}
          className="mt-3 block border-t border-border pt-3 text-xs font-bold text-accent underline"
        >
          Aucun logement dans cette résidence. Publier une annonce.
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary py-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
