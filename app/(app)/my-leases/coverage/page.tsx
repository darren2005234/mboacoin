"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { daysUntil } from "@/lib/lease-schedule";
import { useRequireAuth } from "@/lib/use-require-auth";

const WINDOW_DAYS = 60;

export default function CoverageEndingsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getMyLeases().then((data) => {
      setLeases(data);
      setLoading(false);
    });
  }, [ready]);

  const upcoming = leases
    .filter((l) => l.status === "actif" && l.paymentMode === "avance" && l.endDate)
    .map((l) => ({ lease: l, remaining: daysUntil(l.endDate as string) }))
    .filter((x) => x.remaining <= WINDOW_DAYS)
    .sort((a, b) => a.remaining - b.remaining);

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Couvertures à renouveler"
        subtitle={`Baux en mode avance dont la période payée s'achève dans les ${WINDOW_DAYS} jours (ou déjà échue).`}
      />

      {!ready || loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : upcoming.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Aucune couverture à renouveler pour l&apos;instant
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {upcoming.map(({ lease: l, remaining }) => (
            <button
              key={l.id}
              onClick={() => router.push(`/my-leases/${l.id}`)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-sm font-bold">{l.listingTitle}</p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    remaining < 0 ? "bg-destructive/10 text-destructive" : "bg-pending-bg text-pending-text"
                  }`}
                >
                  {remaining < 0 ? "Période échue, non renouvelée" : `Dans ${remaining} j`}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {l.tenantName ?? "Locataire non rattaché"} · {l.tenantPhone}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Couvert jusqu&apos;au {new Date(l.endDate as string).toLocaleDateString("fr-FR")}
                </p>
                <Price amount={l.rentAmount} suffix="/ mois" size="sm" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
