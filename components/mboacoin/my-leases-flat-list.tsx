"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { MyLeasesToolbar } from "@/components/mboacoin/my-leases-toolbar";
import { LeaseListItem } from "@/components/mboacoin/lease-list-item";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getLeasesScheduleStatus, type LeaseScheduleStatus } from "@/lib/lease-payments";
import { getRenewalIntentsForLeases, type LeaseRenewalIntent } from "@/lib/lease-renewal-intent";
import { countNewLeaseRequestsForLandlord } from "@/lib/lease-requests";
import { useRequireAuth } from "@/lib/use-require-auth";

/** Espace "Mes baux" en liste plate — comptes particulier et agence (pas de résidence à regrouper). */
export function MyLeasesFlatList() {
  const { ready } = useRequireAuth();
  const [optIn] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("opt_in") : null
  );
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<Record<string, LeaseScheduleStatus>>({});
  const [renewalIntents, setRenewalIntents] = useState<Record<string, LeaseRenewalIntent>>({});
  const [newRequests, setNewRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getMyLeases().then(async (data) => {
      setLeases(data);
      setLoading(false);
      const active = data.filter((l) => l.status === "actif");
      const [status, intents] = await Promise.all([
        getLeasesScheduleStatus(active),
        getRenewalIntentsForLeases(active.filter((l) => l.paymentMode === "avance").map((l) => l.id)),
      ]);
      setScheduleStatus(status);
      setRenewalIntents(intents);
    });
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
      />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : leases.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Vous n&apos;avez pas encore créé de bail
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {leases.map((l) => (
            <LeaseListItem
              key={l.id}
              lease={l}
              scheduleStatus={scheduleStatus[l.id]}
              renewalIntent={renewalIntents[l.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
