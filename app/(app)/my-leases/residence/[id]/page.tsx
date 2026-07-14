"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { LeaseListItem } from "@/components/mboacoin/lease-list-item";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getMyResidences } from "@/lib/residences";
import { getMyListings } from "@/lib/my-listings";
import { getLeasesScheduleStatus, type LeaseScheduleStatus } from "@/lib/lease-payments";
import { getRenewalIntentsForLeases, type LeaseRenewalIntent } from "@/lib/lease-renewal-intent";
import { buildResidenceIdByListing, ISOLATED_RESIDENCE_LABEL } from "@/lib/residence-lease-summary";
import { useRequireAuth } from "@/lib/use-require-auth";

const ISOLATED_PARAM = "isoles";

/** Baux d'une résidence (ou des logements isolés) — drill-down depuis /my-leases pour un compte résidence. */
export default function ResidenceLeasesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [name, setName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<Record<string, LeaseScheduleStatus>>({});
  const [renewalIntents, setRenewalIntents] = useState<Record<string, LeaseRenewalIntent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    Promise.all([getMyLeases(), getMyResidences(), getMyListings()]).then(async ([leaseRows, residences, listings]) => {
      const residenceIdByListing = buildResidenceIdByListing(listings);
      const targetId = id === ISOLATED_PARAM ? null : id;

      if (targetId !== null) {
        const residence = residences.find((r) => r.id === targetId);
        if (!residence) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setName(residence.name);
      } else {
        setName(ISOLATED_RESIDENCE_LABEL);
      }

      const filtered = leaseRows.filter((l) => (residenceIdByListing.get(l.listingId) ?? null) === targetId);
      setLeases(filtered);
      setLoading(false);

      const active = filtered.filter((l) => l.status === "actif");
      const [status, intents] = await Promise.all([
        getLeasesScheduleStatus(active),
        getRenewalIntentsForLeases(active.filter((l) => l.paymentMode === "avance").map((l) => l.id)),
      ]);
      setScheduleStatus(status);
      setRenewalIntents(intents);
    });
  }, [ready, id]);

  useEffect(() => {
    if (notFound) router.replace("/my-leases");
  }, [notFound, router]);

  if (!ready || loading || notFound) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={name ?? ""} subtitle={`${leases.length} ${leases.length > 1 ? "baux" : "bail"}`} />

      {leases.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Aucun bail pour l&apos;instant
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
