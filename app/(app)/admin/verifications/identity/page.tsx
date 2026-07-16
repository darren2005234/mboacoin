"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  type PendingVerification,
} from "@/lib/admin-verification";
import { Lightbox } from "@/components/mboacoin/lightbox";

/** Photos (hors PDF) d'une demande, dans l'ordre affiché : sert de groupe pour la visionneuse. */
function imagesFor(item: PendingVerification): string[] {
  const list: string[] = [];
  if (item.documentUrl && !item.isPdf) list.push(item.documentUrl);
  if (item.selfieUrl) list.push(item.selfieUrl);
  if (item.entityDocumentUrl && !item.entityIsPdf) list.push(item.entityDocumentUrl);
  return list;
}

export default function AdminIdentityVerificationsPage() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState<{ images: string[]; index: number } | null>(null);

  async function refresh() {
    setItems(await getPendingVerifications());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(item: PendingVerification) {
    setBusy(item.id);
    await approveVerification(item.id, item.userId);
    await refresh();
    setBusy(null);
  }

  async function confirmReject(item: PendingVerification) {
    if (!reason.trim()) return;
    setBusy(item.id);
    await rejectVerification(item.id, item.userId, reason.trim());
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
      <ScreenHeader title="Vérifications d'identité" subtitle="Demandes d'identité en attente." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-bg">
            <Icon name="check_circle" size={28} className="text-ok-text" />
          </span>
          <p className="text-sm font-bold">Aucune demande en attente</p>
        </div>
      ) : (
        <div className="space-y-4 px-5">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="relative h-56 bg-secondary">
                <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  Document
                </span>
                {!item.documentUrl ? (
                  <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
                    {item.documentPurged ? "Document purgé (conformité loi n°2024/017)" : "Document indisponible"}
                  </div>
                ) : item.isPdf ? (

                  <a  href={item.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col items-center justify-center gap-2 text-center"
                  >
                    <Icon name="picture_as_pdf" size={40} className="text-destructive" />
                    <span className="text-sm font-semibold text-primary underline">Ouvrir le PDF</span>
                    <span className="text-xs text-muted-foreground">S&apos;ouvre dans un nouvel onglet</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-label="Agrandir le document"
                    className="absolute inset-0"
                    onClick={() => {
                      const images = imagesFor(item);
                      setZoom({ images, index: images.indexOf(item.documentUrl!) });
                    }}
                  >
                    <Image src={item.documentUrl} alt="Document" fill className="object-contain" sizes="400px" unoptimized />
                  </button>
                )}
              </div>
              {/* Selfie en direct, pour comparer les visages */}
              {(item.selfieUrl || item.selfiePurged) && (
                <div className="border-t border-border">
                  <div className="relative h-56 bg-secondary">
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      Photo en direct
                    </span>
                    {!item.selfieUrl ? (
                      <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
                        {item.selfiePurged ? "Document purgé (conformité loi n°2024/017)" : "Document indisponible"}
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Agrandir la photo en direct"
                        className="absolute inset-0"
                        onClick={() => {
                          const images = imagesFor(item);
                          setZoom({ images, index: images.indexOf(item.selfieUrl!) });
                        }}
                      >
                        <Image src={item.selfieUrl} alt="Photo en direct" fill className="object-contain" sizes="400px" unoptimized />
                      </button>
                    )}
                  </div>
                  {item.selfieUrl && (
                    <p className="bg-pending-bg px-3 py-2 text-xs text-pending-text">
                      Vérifiez que le visage de la photo en direct correspond bien à celui du document.
                    </p>
                  )}
                </div>
              )}
              {/* Document d'entité (comptes agence/résidence uniquement) */}
              {(item.entityDocumentUrl || item.entityDocumentPurged) && (
                <div className="border-t border-border">
                  <div className="relative h-56 bg-secondary">
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-foreground/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      Document de l&apos;entité
                    </span>
                    {!item.entityDocumentUrl ? (
                      <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
                        {item.entityDocumentPurged ? "Document purgé (conformité loi n°2024/017)" : "Document indisponible"}
                      </div>
                    ) : item.entityIsPdf ? (
                      <a
                        href={item.entityDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-full flex-col items-center justify-center gap-2 text-center"
                      >
                        <Icon name="picture_as_pdf" size={40} className="text-destructive" />
                        <span className="text-sm font-semibold text-primary underline">Ouvrir le PDF</span>
                        <span className="text-xs text-muted-foreground">S&apos;ouvre dans un nouvel onglet</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        aria-label="Agrandir le document de l'entité"
                        className="absolute inset-0"
                        onClick={() => {
                          const images = imagesFor(item);
                          setZoom({ images, index: images.indexOf(item.entityDocumentUrl!) });
                        }}
                      >
                        <Image src={item.entityDocumentUrl} alt="Document de l'entité" fill className="object-contain" sizes="400px" unoptimized />
                      </button>
                    )}
                  </div>
                  {item.entityDocumentType && (
                    <p className="bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                      Type : {item.entityDocumentType}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{item.userName}</p>
                    {item.entityDocumentType && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                        Compte professionnel
                      </span>
                    )}
                    {item.suspended && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                        Suspendu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.documentType ?? "Document"}</p>
                </div>

                {rejecting === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      placeholder="Motif du rejet (document illisible, non conforme...)"
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

      {zoom && (
        <Lightbox images={zoom.images} startIndex={zoom.index} onClose={() => setZoom(null)} unoptimized />
      )}
    </div>
  );
}
