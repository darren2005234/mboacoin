"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import {
  getMyListings,
  updateListingStatus,
  deleteListing,
  type MyListing,
} from "@/lib/my-listings";

export default function MyListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setListings(await getMyListings());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleRented(l: MyListing) {
    setBusy(l.id);
    const next = l.status === "louee" ? "publiee" : "louee";
    await updateListingStatus(l.id, next);
    await refresh();
    setBusy(null);
  }

  async function remove(l: MyListing) {
    if (!confirm(`Supprimer définitivement « ${l.title} » ?`)) return;
    setBusy(l.id);
    await deleteListing(l.id);
    await refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes annonces" />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <p className="text-sm font-bold">Vous n&apos;avez pas encore d&apos;annonce</p>
          <button
            onClick={() => router.push("/publish")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
          >
            Publier une annonce
          </button>
        </div>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {listings.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <button
                onClick={() => router.push(`/listings/${l.id}`)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  <Image src={l.image} alt="" fill className="object-cover" sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-bold">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.location}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Price amount={l.price} suffix={l.priceSuffix} size="sm" />
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              </button>

              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => router.push(`/listings/${l.id}/edit`)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-bold text-foreground"
                >
                  <Icon name="edit" size={16} filled={false} /> Modifier
                </button>
                <button
                  onClick={() => toggleRented(l)}
                  disabled={busy === l.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-bold text-foreground disabled:opacity-50"
                >
                  <Icon name={l.status === "louee" ? "restart_alt" : "check_circle"} size={16} />
                  {l.status === "louee" ? "Remettre en ligne" : "Marquer louée"}
                </button>
                <button
                  onClick={() => remove(l)}
                  disabled={busy === l.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-bold text-destructive disabled:opacity-50"
                >
                  <Icon name="delete" size={16} filled={false} /> Supprimer
                </button>
              </div>
              {l.propertyVerified ? (
                <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-seal-bg py-2 text-xs font-bold text-seal-text">
                  <Icon name="verified" size={16} /> Logement vérifié
                </div>
              ) : (
                <button
                  onClick={() => router.push(`/listings/${l.id}/verify`)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 py-2 text-xs font-bold text-accent"
                >
                  <Icon name="verified_user" size={16} filled={false} /> Faire vérifier ce logement
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    publiee: { label: "Publiée", cls: "bg-ok-bg text-ok-text" },
    louee: { label: "Louée", cls: "bg-pending-bg text-pending-text" },
    brouillon: { label: "Brouillon", cls: "bg-secondary text-muted-foreground" },
    en_attente: { label: "En attente", cls: "bg-pending-bg text-pending-text" },
    suspendue: { label: "Suspendue", cls: "bg-pending-bg text-pending-text" },
    rejetee: { label: "Rejetée", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? map.brouillon;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}