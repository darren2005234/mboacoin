"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/mboacoin/lightbox";
import { ComparisonLightbox } from "@/components/mboacoin/comparison-lightbox";
import {
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  INSPECTION_STATUS_LABELS,
  getInspection,
  createInspection,
  addRoom,
  deleteRoom,
  addRoomPhoto,
  addRoomObservation,
  submitInspection,
  validateInspection,
  disputeInspection,
  getInspectionPhotoSignedUrl,
  compareInspectionRooms,
  type Inspection,
  type InspectionRoom,
  type RoomComparison,
} from "@/lib/property-inspections";

const smallInputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

const STATUS_BADGE_CLS: Record<string, string> = {
  brouillon: "bg-secondary text-muted-foreground",
  soumis: "bg-pending-bg text-pending-text",
  conteste: "bg-destructive/10 text-destructive",
  valide: "bg-ok-bg text-ok-text",
};

export function InspectionView({
  leaseId,
  type,
  role,
}: {
  leaseId: string;
  type: "entree" | "sortie";
  role: "bailleur" | "locataire";
}) {
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [sibling, setSibling] = useState<Inspection | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [newRoomType, setNewRoomType] = useState<string>(ROOM_TYPES[0]);
  const [newRoomLabel, setNewRoomLabel] = useState("");
  const [compareRoom, setCompareRoom] = useState<RoomComparison | null>(null);
  const [compareUrls, setCompareUrls] = useState<{ entree: string[]; sortie: string[] }>({ entree: [], sortie: [] });

  useEffect(() => {
    if (!compareRoom) return;
    Promise.all([
      Promise.all((compareRoom.entree?.photos ?? []).map((p) => getInspectionPhotoSignedUrl(p.storagePath))),
      Promise.all((compareRoom.sortie?.photos ?? []).map((p) => getInspectionPhotoSignedUrl(p.storagePath))),
    ]).then(([entree, sortie]) => {
      setCompareUrls({
        entree: entree.filter((u): u is string => !!u),
        sortie: sortie.filter((u): u is string => !!u),
      });
    });
  }, [compareRoom]);

  async function refresh() {
    const insp = await getInspection(leaseId, type);
    setInspection(insp);
    const siblingType = type === "entree" ? "sortie" : "entree";
    setSibling(await getInspection(leaseId, siblingType));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId, type]);

  async function onCreate() {
    setError(null);
    setBusy("create");
    const result = await createInspection(leaseId, type);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!inspection) return;
    setError(null);
    setBusy("add-room");
    const result = await addRoom(inspection.id, newRoomType, newRoomLabel);
    if (result.error) setError(result.error);
    else setNewRoomLabel("");
    await refresh();
    setBusy(null);
  }

  async function onDeleteRoom(pieceId: string) {
    setError(null);
    setBusy(`delete-${pieceId}`);
    const result = await deleteRoom(pieceId);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onUploadPhoto(pieceId: string, file: File) {
    setError(null);
    setBusy(`photo-${pieceId}`);
    const result = await addRoomPhoto(leaseId, pieceId, file);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onAddObservation(pieceId: string, texte: string) {
    setError(null);
    setBusy(`obs-${pieceId}`);
    const result = await addRoomObservation(pieceId, texte);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onSubmit() {
    if (!inspection) return;
    setError(null);
    setBusy("submit");
    const result = await submitInspection(inspection.id);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onValidate() {
    if (!inspection) return;
    setError(null);
    setBusy("validate");
    const result = await validateInspection(inspection.id);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  async function onDispute() {
    if (!inspection) return;
    setError(null);
    setBusy("dispute");
    const result = await disputeInspection(inspection.id, disputeReason);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setShowDisputeForm(false);
    setDisputeReason("");
    await refresh();
    setBusy(null);
  }

  if (inspection === undefined) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  const typeLabel = type === "entree" ? "État des lieux d'entrée" : "État des lieux de sortie";

  if (!inspection) {
    return (
      <div className="space-y-4 px-5 pb-8">
        <h1 className="text-lg font-bold">{typeLabel}</h1>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {role === "bailleur" ? (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm text-muted-foreground">
              Aucun état des lieux {type === "entree" ? "d'entrée" : "de sortie"} pour ce bail pour l&apos;instant.
            </p>
            <Button onClick={onCreate} disabled={busy === "create"} className="w-full">
              {busy === "create" ? "..." : "Créer l'état des lieux"}
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
            Le bailleur n&apos;a pas encore créé cet état des lieux.
          </p>
        )}
      </div>
    );
  }

  const canEditAsLandlord = role === "bailleur" && (inspection.status === "brouillon" || inspection.status === "conteste");
  const canContributeAsTenant = role === "locataire" && inspection.status === "soumis";
  const canManageRoomStructure = role === "bailleur" && inspection.status === "brouillon";
  const isLocked = inspection.status === "valide";

  const comparison = compareInspectionRooms(type === "entree" ? inspection : sibling, type === "sortie" ? inspection : sibling);

  return (
    <div className="space-y-4 px-5 pb-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{typeLabel}</h1>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE_CLS[inspection.status]}`}>
          {INSPECTION_STATUS_LABELS[inspection.status] ?? inspection.status}
        </span>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {isLocked && (
        <div className="flex items-center gap-2 rounded-2xl border border-ok-bg bg-ok-bg/40 p-4 shadow-card">
          <Icon name="lock" size={18} className="text-ok-text" />
          <p className="text-xs font-semibold text-ok-text">
            Document verrouillé{inspection.validatedAt ? ` le ${new Date(inspection.validatedAt).toLocaleDateString("fr-FR")}` : ""}.
            Aucune modification n&apos;est plus possible.
          </p>
        </div>
      )}

      {inspection.status === "conteste" && inspection.disputeReason && (
        <div className="space-y-1 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-card">
          <p className="text-sm font-bold text-destructive">Contesté par le locataire</p>
          <p className="text-xs text-muted-foreground">{inspection.disputeReason}</p>
        </div>
      )}

      {sibling && (
        <button
          onClick={() => setShowComparison((v) => !v)}
          className="w-full rounded-full bg-secondary px-4 py-2.5 text-xs font-bold"
        >
          {showComparison ? "Masquer la comparaison" : `Comparer avec ${type === "entree" ? "la sortie" : "l'entrée"}`}
        </button>
      )}

      {showComparison && sibling && (
        <div className="space-y-3">
          {comparison.map((c) => (
            <div key={c.key} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-bold">
                {ROOM_TYPE_LABELS[c.typePiece] ?? c.typePiece} — {c.libelle}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ComparisonSide label="Entrée" room={c.entree} onOpen={() => setCompareRoom(c)} />
                <ComparisonSide label="Sortie" room={c.sortie} onOpen={() => setCompareRoom(c)} />
              </div>
            </div>
          ))}
          {comparison.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucune pièce à comparer pour l&apos;instant.</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {inspection.rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            canDelete={canManageRoomStructure}
            canContribute={canEditAsLandlord || canContributeAsTenant}
            busy={busy}
            onDelete={() => onDeleteRoom(room.id)}
            onUploadPhoto={(file) => onUploadPhoto(room.id, file)}
            onAddObservation={(texte) => onAddObservation(room.id, texte)}
          />
        ))}
        {inspection.rooms.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">Aucune pièce ajoutée pour l&apos;instant.</p>
        )}
      </div>

      {canEditAsLandlord && (
        <form onSubmit={onAddRoom} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Ajouter une pièce</p>
          <div className="flex gap-2">
            <select
              value={newRoomType}
              onChange={(e) => setNewRoomType(e.target.value)}
              className={`${smallInputCls} max-w-[40%]`}
            >
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ROOM_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              value={newRoomLabel}
              onChange={(e) => setNewRoomLabel(e.target.value)}
              placeholder="Libellé (ex : Chambre parents)"
              className={smallInputCls}
            />
          </div>
          <Button type="submit" disabled={busy === "add-room"} className="w-full">
            {busy === "add-room" ? "..." : "Ajouter"}
          </Button>
        </form>
      )}

      {role === "bailleur" && (inspection.status === "brouillon" || inspection.status === "conteste") && inspection.rooms.length > 0 && (
        <Button onClick={onSubmit} disabled={busy === "submit"} className="w-full">
          {busy === "submit" ? "..." : "Soumettre au locataire"}
        </Button>
      )}

      {canContributeAsTenant && (
        <div className="space-y-2">
          <Button onClick={onValidate} disabled={busy === "validate"} className="w-full">
            {busy === "validate" ? "..." : "Valider l'état des lieux"}
          </Button>
          {showDisputeForm ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <label className="field-label">Motif de la contestation</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                placeholder="Expliquez pourquoi vous contestez cet état des lieux"
                className={smallInputCls}
              />
              <Button onClick={onDispute} disabled={busy === "dispute"} variant="outline" className="w-full text-destructive">
                {busy === "dispute" ? "..." : "Confirmer la contestation"}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="w-full rounded-full bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive"
            >
              Contester
            </button>
          )}
        </div>
      )}

      {compareRoom && (
        <ComparisonLightbox
          entreeImages={compareUrls.entree}
          sortieImages={compareUrls.sortie}
          onClose={() => setCompareRoom(null)}
          unoptimized
        />
      )}
    </div>
  );
}

function ComparisonSide({
  label,
  room,
  onOpen,
}: {
  label: string;
  room: InspectionRoom | null;
  onOpen: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!room) return;
    Promise.all(room.photos.map(async (p) => [p.id, await getInspectionPhotoSignedUrl(p.storagePath)] as const)).then(
      (entries) => setUrls(Object.fromEntries(entries.filter(([, url]) => url) as [string, string][]))
    );
  }, [room]);

  if (!room) {
    return (
      <div>
        <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Pièce absente</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {room.photos.map((p) => (
          <button key={p.id} type="button" onClick={onOpen} aria-label="Agrandir et comparer">
            <img src={urls[p.id]} alt="" className="size-14 rounded-lg object-cover" />
          </button>
        ))}
      </div>
      {room.observations.map((o) => (
        <p key={o.id} className="text-xs">
          <span className="text-muted-foreground">{o.auteurRole === "bailleur" ? "Bailleur" : "Locataire"} : </span>
          {o.texte}
        </p>
      ))}
    </div>
  );
}

function RoomCard({
  room,
  canDelete,
  canContribute,
  busy,
  onDelete,
  onUploadPhoto,
  onAddObservation,
}: {
  room: InspectionRoom;
  canDelete: boolean;
  canContribute: boolean;
  busy: string | null;
  onDelete: () => void;
  onUploadPhoto: (file: File) => void;
  onAddObservation: (texte: string) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [observationText, setObservationText] = useState("");
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all(room.photos.map(async (p) => [p.id, await getInspectionPhotoSignedUrl(p.storagePath)] as const)).then(
      (entries) => setUrls(Object.fromEntries(entries.filter(([, url]) => url) as [string, string][]))
    );
  }, [room.photos]);

  const photoUrls = room.photos.map((p) => urls[p.id]).filter((u): u is string => typeof u === "string");

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onUploadPhoto(file);
  }

  function submitObservation() {
    if (!observationText.trim()) return;
    onAddObservation(observationText);
    setObservationText("");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{room.libelle}</p>
          <p className="text-xs text-muted-foreground">{ROOM_TYPE_LABELS[room.typePiece] ?? room.typePiece}</p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={busy === `delete-${room.id}`}
            className="text-xs font-bold text-destructive underline disabled:opacity-50"
          >
            Supprimer
          </button>
        )}
      </div>

      {room.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {room.photos.map((p) => {
            const url = urls[p.id];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => url && setZoomIndex(photoUrls.indexOf(url))}
                className="relative"
                aria-label="Agrandir la photo"
              >
                <img src={url} alt="" className="size-16 rounded-lg object-cover" />
                <span
                  className={`absolute -bottom-1 -right-1 rounded px-1 text-[8px] font-bold text-white ${
                    p.auteurRole === "bailleur" ? "bg-accent" : "bg-primary"
                  }`}
                >
                  {p.auteurRole === "bailleur" ? "B" : "L"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {zoomIndex !== null && (
        <Lightbox images={photoUrls} startIndex={zoomIndex} onClose={() => setZoomIndex(null)} unoptimized />
      )}

      {room.observations.length > 0 && (
        <div className="space-y-1">
          {room.observations.map((o) => (
            <p key={o.id} className="text-xs">
              <span className="font-semibold">{o.auteurRole === "bailleur" ? "Bailleur" : "Locataire"} : </span>
              {o.texte}
            </p>
          ))}
        </div>
      )}

      {canContribute && (
        <div className="space-y-2 border-t border-border pt-2">
          <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-bold">
            <Icon name="add_a_photo" size={16} filled={false} />
            {busy === `photo-${room.id}` ? "Envoi en cours..." : "Ajouter une photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickPhoto} className="hidden" />
          </label>
          <div className="flex gap-1.5">
            <input
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              placeholder="Ajouter une observation"
              className={smallInputCls}
            />
            <button
              onClick={submitObservation}
              disabled={busy === `obs-${room.id}`}
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
