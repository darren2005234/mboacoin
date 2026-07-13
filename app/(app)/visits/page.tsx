"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { getMyVisits, formatVisitDateTime, type Visit } from "@/lib/visits";
import { VisitStatusBadge } from "@/components/mboacoin/visit-status-badge";
import { useRequireAuth } from "@/lib/use-require-auth";

function VisitsInner() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const searchParams = useSearchParams();
  const listingIdFilter = searchParams.get("listingId");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getMyVisits().then((v) => {
      setVisits(v);
      setLoading(false);
    });
  }, [ready]);

  const filtered = listingIdFilter ? visits.filter((v) => v.listingId === listingIdFilter) : visits;

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes visites" />

      {!ready || loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-secondary">
            <Icon name="calendar_month" size={30} className="text-muted-foreground" filled={false} />
          </span>
          <p className="text-sm font-bold">Aucune visite pour le moment</p>
          <p className="text-sm text-muted-foreground">
            Les demandes de visite que vous envoyez ou recevez apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => router.push(`/visits/${v.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <Image src={v.listingImage} alt="" fill className="object-cover" sizes="64px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{v.listingTitle}</p>
                <p className="text-xs text-muted-foreground">{v.listingLocation}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {v.role === "locataire" ? "Vous visitez" : "Demande reçue"}
                  </span>
                  <VisitStatusBadge status={v.status} />
                </div>
                {v.scheduledAt && (
                  <p className="mt-1 text-xs font-medium text-foreground">{formatVisitDateTime(v.scheduledAt)}</p>
                )}
              </div>
              <Icon name="chevron_right" size={20} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>}>
      <VisitsInner />
    </Suspense>
  );
}
