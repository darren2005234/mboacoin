"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { getMyVerificationStatus, submitVerification, getMyAccountType } from "@/lib/verification";
import { CameraCapture } from "@/components/mboacoin/camera-capture";
import { ENTITY_DOCUMENT_TYPES } from "@/lib/entity-document-types";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRequireAuth } from "@/lib/use-require-auth";

const DOC_TYPES = ["Carte Nationale d'Identité", "Passeport", "Permis de conduire"];

export default function VerificationPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [status, setStatus] = useState<string>("aucune");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState("personne_physique");
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [entityDocType, setEntityDocType] = useState(ENTITY_DOCUMENT_TYPES[0]);
  const [entityDocTypeOther, setEntityDocTypeOther] = useState("");
  const [entityFile, setEntityFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const entityInputRef = useRef<HTMLInputElement>(null);

  const isEntity = accountType === "agence" || accountType === "residence";

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [s, type] = await Promise.all([getMyVerificationStatus(), getMyAccountType()]);
      setStatus(s.status);
      setRejectionReason(s.rejectionReason);
      setAccountType(type);
      setLoading(false);
    })();
  }, [ready]);

  function onSelfieCaptured(f: File) {
    setSelfie(f);
    // Aperçu du selfie
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfieUrl(URL.createObjectURL(f));
    setCameraOpen(false);
  }

  async function submit() {
    setError(null);
    if (!file) {
      setError("Choisissez une photo de votre pièce d'identité.");
      return;
    }
    if (!selfie) {
      setError("Prenez votre photo en direct.");
      return;
    }
    const resolvedEntityType = entityDocType === "Autre" ? entityDocTypeOther.trim() : entityDocType;
    if (isEntity && !entityFile) {
      setError("Ajoutez le document de votre entité.");
      return;
    }
    if (isEntity && !resolvedEntityType) {
      setError("Précisez le type de document de votre entité.");
      return;
    }
    setSubmitting(true);
    const result = await submitVerification(
      file,
      docType,
      selfie,
      isEntity && entityFile ? { file: entityFile, type: resolvedEntityType } : undefined
    );
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  }

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (done || status === "en_attente") {
    return (
      <div className="flex flex-col">
        <Link href="/profile" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <ScreenHeader title="Vérification d'identité" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-pending-bg">
            <Icon name="hourglass_top" size={30} className="text-pending-text" />
          </span>
          <h2 className="text-base font-bold">Demande en cours d&apos;examen</h2>
          <p className="text-sm text-muted-foreground">
            Votre document et votre photo ont bien été reçus. Notre équipe les examine, vous serez notifié du résultat.
          </p>
          <Button variant="outline" size="lg" className="mt-2" onClick={() => router.push("/profile")}>
            Retour au profil
          </Button>
        </div>
      </div>
    );
  }

  if (status === "validee") {
    return (
      <div className="flex flex-col">
        <Link href="/profile" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <ScreenHeader title="Vérification d'identité" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-ok-bg">
            <Icon name="verified" size={30} className="text-ok-text" />
          </span>
          <h2 className="text-base font-bold">Identité vérifiée</h2>
          <p className="text-sm text-muted-foreground">
            Votre identité a été validée. Le badge vérifié apparaît sur votre profil et vos annonces.
          </p>
          <Button variant="outline" size="lg" className="mt-2" onClick={() => router.push("/profile")}>
            Retour au profil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/profile" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Vérification d'identité" subtitle="Faites vérifier votre identité pour gagner la confiance des utilisateurs." />

      <div className="space-y-5 px-5">
        {status === "rejetee" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-bold text-destructive">Demande précédente rejetée</p>
            {rejectionReason && <p className="mt-0.5 text-xs text-muted-foreground">Motif : {rejectionReason}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Vous pouvez soumettre une nouvelle demande.</p>
          </div>
        )}

        <div className="rounded-xl bg-secondary/60 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="lock" size={18} className="text-accent" /> Confidentialité
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Votre document et votre photo sont stockés de manière sécurisée, à accès restreint, et ne servent qu&apos;à vérifier votre identité. Ils ne sont jamais rendus publics.
          </p>
        </div>

        <div>
          <label className="field-label">Type de document</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Photo du document</label>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center"
          >
            <Icon name={file ? "check_circle" : "add_a_photo"} size={26} className={file ? "text-ok-text" : "text-muted-foreground"} filled={false} />
            <span className="text-sm font-medium text-muted-foreground">
              {file ? file.name : "Ajouter une photo nette et lisible"}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>

        {/* Selfie en direct */}
        <div>
          <label className="field-label">Votre photo (prise en direct)</label>
          {selfie && selfieUrl ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selfieUrl} alt="Votre photo" className="size-16 rounded-xl object-cover" />
              <div className="flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ok-text">
                  <Icon name="check_circle" size={16} /> Photo prise
                </p>
                <button onClick={() => setCameraOpen(true)} className="mt-0.5 text-xs font-semibold text-primary">
                  Reprendre la photo
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCameraOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center"
            >
              <Icon name="photo_camera" size={26} className="text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Prendre ma photo en direct</span>
            </button>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cette photo, prise sur le moment, permet de confirmer que vous êtes bien la personne du document.
          </p>
        </div>

        {isEntity && (
          <div className="space-y-5 rounded-2xl border border-border bg-secondary/30 p-4">
            <div>
              <p className="text-sm font-bold">Document de l&apos;entité</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                En plus de votre identité, votre compte {accountType === "agence" ? "agence" : "résidence"} doit fournir un document prouvant l&apos;entité.
              </p>
            </div>

            <div>
              <label className="field-label">Type de document</label>
              <select
                value={entityDocType}
                onChange={(e) => setEntityDocType(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
              >
                {ENTITY_DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {entityDocType === "Autre" && (
              <div>
                <label className="field-label">Précisez le type de document</label>
                <input
                  value={entityDocTypeOther}
                  onChange={(e) => setEntityDocTypeOther(e.target.value)}
                  placeholder="Ex : Autorisation municipale"
                  className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
                />
              </div>
            )}

            <div>
              <label className="field-label">Photo ou PDF du document</label>
              <button
                onClick={() => entityInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card py-8 text-center"
              >
                <Icon name={entityFile ? "check_circle" : "add_a_photo"} size={26} className={entityFile ? "text-ok-text" : "text-muted-foreground"} filled={false} />
                <span className="text-sm font-medium text-muted-foreground">
                  {entityFile ? entityFile.name : "Ajouter le document de l'entité"}
                </span>
              </button>
              <input
                ref={entityInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setEntityFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? "Envoi..." : "Soumettre pour vérification"}
        </Button>
      </div>

      {cameraOpen && (
        <CameraCapture onCapture={onSelfieCaptured} onCancel={() => setCameraOpen(false)} />
      )}
    </div>
  );
}