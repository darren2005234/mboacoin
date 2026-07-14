"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import { PushOptInCard } from "@/components/mboacoin/push-opt-in-card";
import { priceSuffixFor } from "@/lib/price-period";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getLeasesLateStatus } from "@/lib/lease-payments";
import { countNewLeaseRequestsForLandlord } from "@/lib/lease-requests";
import { nextPaymentDueDate, daysUntil } from "@/lib/lease-schedule";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function MyLeasesPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [optIn] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("opt_in") : null
  );
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [lateStatus, setLateStatus] = useState<Record<string, boolean>>({});
  const [newRequests, setNewRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getMyLeases().then(async (data) => {
      setLeases(data);
      setLoading(false);
      const active = data.filter((l) => l.status === "actif");
      setLateStatus(await getLeasesLateStatus(active));
    });
    countNewLeaseRequestsForLandlord().then(setNewRequests);
  }, [ready]);

  if (!ready) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes baux" />

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

      {leases.some((l) => l.paymentMode === "avance") && (
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

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : leases.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Vous n&apos;avez pas encore créé de bail
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {leases.map((l) => {
            const dueDate =
              l.status === "actif" ? nextPaymentDueDate(l.startDate, l.paymentDay, l.paymentPeriod) : null;
            const remaining = l.status === "actif" && l.endDate ? daysUntil(l.endDate) : null;
            return (
              <Link
                key={l.id}
                href={`/my-leases/${l.id}`}
                className="block rounded-2xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    <Image src={l.listingImage} alt="" fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold">{l.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.tenantName ?? "Locataire non rattaché"} · {l.tenantPhone}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Price amount={l.rentAmount} suffix={priceSuffixFor(l.paymentPeriod)} size="sm" />
                      <StatusBadge status={l.status} />
                      {l.status === "actif" && l.paymentMode !== "avance" && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            lateStatus[l.id] ? "bg-destructive/10 text-destructive" : "bg-ok-bg text-ok-text"
                          }`}
                        >
                          {lateStatus[l.id] ? "En retard" : "À jour"}
                        </span>
                      )}
                      {remaining !== null && remaining <= 30 && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            remaining < 0 ? "bg-destructive/10 text-destructive" : "bg-pending-bg text-pending-text"
                          }`}
                        >
                          {l.paymentMode === "avance"
                            ? remaining < 0
                              ? "Échue"
                              : "Bientôt échue"
                            : remaining < 0
                              ? "Échéance dépassée"
                              : "Échéance proche"}
                        </span>
                      )}
                    </div>
                    {l.status === "actif" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.paymentMode === "avance"
                          ? l.endDate
                            ? `Couvert jusqu'au ${new Date(l.endDate).toLocaleDateString("fr-FR")}`
                            : "Aucune période payée pour l'instant"
                          : dueDate
                            ? `Prochain loyer dû le ${dueDate.toLocaleDateString("fr-FR")}`
                            : "Facturation quotidienne"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>Début : {new Date(l.startDate).toLocaleDateString("fr-FR")}</span>
                  <span>{l.durationMonths ? `${l.durationMonths} mois` : "Durée indéterminée"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    en_attente_confirmation: { label: "En attente", cls: "bg-pending-bg text-pending-text" },
    actif: { label: "Actif", cls: "bg-ok-bg text-ok-text" },
    rejete: { label: "Rejeté", cls: "bg-destructive/10 text-destructive" },
    termine: { label: "Terminé", cls: "bg-secondary text-muted-foreground" },
    resilie: { label: "Résilié", cls: "bg-secondary text-muted-foreground" },
    arrete: { label: "Arrêté", cls: "bg-secondary text-muted-foreground" },
    annule: { label: "Annulé", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? map.en_attente_confirmation;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
