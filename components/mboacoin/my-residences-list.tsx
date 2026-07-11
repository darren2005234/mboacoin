"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import {
  getMyResidences,
  deleteResidence,
  type Residence,
} from "@/lib/residences";

export function MyResidencesList() {
  const router = useRouter();
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setResidences(await getMyResidences());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(r: Residence) {
    if (!confirm(`Supprimer définitivement « ${r.name} » ?`)) return;
    setBusy(r.id);
    await deleteResidence(r.id);
    await refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes résidences" />

      <div className="px-5 pb-3">
        <button
          onClick={() => router.push("/my-residences/new")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-btn"
        >
          <Icon name="add" size={18} /> Créer une résidence
        </button>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : residences.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <p className="text-sm font-bold">Vous n&apos;avez pas encore de résidence</p>
          <p className="text-xs text-muted-foreground">
            Créez votre première résidence pour pouvoir y rattacher des logements.
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {residences.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <button
                onClick={() => router.push(`/my-residences/${r.id}/edit`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  <Image
                    src={r.imageUrl ?? "/img/listings/demo-1.jpg"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-bold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.neighborhood, r.city].filter(Boolean).join(", ")}
                  </p>
                </div>
              </button>
              <button
                onClick={() => remove(r)}
                disabled={busy === r.id}
                aria-label="Supprimer"
                className="shrink-0 text-muted-foreground disabled:opacity-50"
              >
                <Icon name="delete" size={20} filled={false} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
