"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";
import { PushOptInCard } from "@/components/mboacoin/push-opt-in-card";

/**
 * Bloc d'en-tête commun aux vues "Mes baux" (liste plate et vue par
 * résidence) : actions rapides, carte d'opt-in push, bannière de
 * couvertures à renouveler. Partagé pour que les deux vues ne divergent
 * jamais sur ces éléments.
 */
export function MyLeasesToolbar({
  optIn,
  newRequests,
  hasAdvanceLease,
}: {
  optIn: string | null;
  newRequests: number;
  hasAdvanceLease: boolean;
}) {
  const router = useRouter();

  return (
    <>
      {optIn === "lease_created" && <PushOptInCard context="lease_created" />}

      <div className="flex gap-2 px-5 pb-4">
        <button
          onClick={() => router.push("/my-leases/new")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
        >
          <Icon name="add" size={18} /> Nouveau bail
        </button>
        <button
          onClick={() => router.push("/my-leases/requests")}
          className="relative flex flex-1 items-center justify-center gap-1.5 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold"
        >
          <Icon name="handyman" size={18} filled={false} /> Demandes
          {newRequests > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {newRequests}
            </span>
          )}
        </button>
      </div>

      {hasAdvanceLease && (
        <Link
          href="/my-leases/coverage"
          className="mx-5 mb-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="icon-badge size-9">
              <Icon name="event_upcoming" size={18} filled={false} />
            </span>
            <p className="text-sm font-bold">Couvertures à renouveler</p>
          </div>
          <Icon name="chevron_right" size={18} className="text-muted-foreground" />
        </Link>
      )}
    </>
  );
}
