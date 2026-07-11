"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import { priceSuffixFor } from "@/lib/price-period";
import { getMyLeases, type MyLease } from "@/lib/leases";
import { getLeasesLateStatus } from "@/lib/lease-payments";

export default function MyLeasesPage() {
  const router = useRouter();
  const [leases, setLeases] = useState<MyLease[]>([]);
  const [lateStatus, setLateStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyLeases().then(async (data) => {
      setLeases(data);
      setLoading(false);
      const active = data.filter((l) => l.status === "actif");
      setLateStatus(await getLeasesLateStatus(active));
    });
  }, []);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes baux" />

      <div className="px-5 pb-4">
        <button
          onClick={() => router.push("/my-leases/new")}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
        >
          <Icon name="add" size={18} /> Nouveau bail
        </button>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : leases.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Vous n&apos;avez pas encore créé de bail
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {leases.map((l) => (
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
                    {l.status === "actif" && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          lateStatus[l.id] ? "bg-destructive/10 text-destructive" : "bg-ok-bg text-ok-text"
                        }`}
                      >
                        {lateStatus[l.id] ? "En retard" : "À jour"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Début : {new Date(l.startDate).toLocaleDateString("fr-FR")}</span>
                <span>{l.durationMonths ? `${l.durationMonths} mois` : "Durée indéterminée"}</span>
              </div>
            </Link>
          ))}
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
  };
  const s = map[status] ?? map.en_attente_confirmation;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
