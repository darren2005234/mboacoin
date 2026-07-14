"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import {
  getPendingListingVerifs,
  approveListingVerif,
  rejectListingVerif,
  type PendingListingVerif,
} from "@/lib/admin-listing-verification";

export default function AdminListingVerifsPage() {
  const [items, setItems] = useState<PendingListingVerif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function refresh() {
    setItems(await getPendingListingVerifs());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(item: PendingListingVerif) {
    setBusy(item.id);
    await approveListingVerif(item.id, item.listingId);
    await refresh();
    setBusy(null);
  }

  async function confirmReject(item: PendingListingVerif) {
    if (!reason.trim()) return;
    setBusy(item.id);
    await rejectListingVerif(item.id, reason.trim());
    setRejecting(null);
    setReason("");
    await refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin/verifications" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Vérifications logement" subtitle="Vidéos de logements en attente." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-bg">
            <Icon name="check_circle" size={28} className="text-ok-text" />
          </span>
          <p className="text-sm font-bold">Aucune vidéo en attente</p>
        </div>
      ) : (
        <div className="space-y-4 px-5">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="bg-black">
                {item.videoUrl ? (
                  <video src={item.videoUrl} controls className="max-h-80 w-full" />
                ) : (
                  <div className="grid h-40 place-items-center px-4 text-center text-sm text-white/60">
                    {item.videoPurged ? "Vidéo purgée (conformité loi n°2024/017)" : "Vidéo indisponible"}
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-sm font-bold">{item.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">Par {item.ownerName}</p>
                  <a
                    href={`/listings/${item.listingId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent underline"
                  >
                    <Icon name="open_in_new" size={14} /> Voir l&apos;annonce pour comparer
                  </a>
                </div>

                {rejecting === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      placeholder="Motif du rejet (vidéo floue, incomplète, ne correspond pas...)"
                      className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setRejecting(null); setReason(""); }}>
                        Annuler
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => confirmReject(item)} disabled={busy === item.id || !reason.trim()}>
                        Confirmer le rejet
                      </Button>
                    </div>
                    <p className="rounded-lg bg-pending-bg px-3 py-2 text-xs text-pending-text">
                  Vérifiez que la vidéo se termine par un pouce levé 👍 et que toutes les pièces sont filmées.
                </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1 text-destructive"
                      onClick={() => setRejecting(item.id)}
                      disabled={busy === item.id}
                    >
                      <Icon name="close" size={18} /> Rejeter
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1"
                      onClick={() => approve(item)}
                      disabled={busy === item.id}
                    >
                      <Icon name="check" size={18} /> Valider
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
