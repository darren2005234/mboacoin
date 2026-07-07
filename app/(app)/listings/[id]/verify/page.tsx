"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import {
  getListingVerifStatus,
  submitListingVerification,
  getVideoDuration,
} from "@/lib/listing-verification";

const MAX_DURATION = 185; // 3 min + petite marge (secondes)
const MAX_SIZE_MB = 50;

export default function VerifyListingPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = String(params.id);

  const [status, setStatus] = useState("aucune");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const s = await getListingVerifStatus(listingId);
      setStatus(s.status);
      setRejectionReason(s.rejectionReason);
      setLoading(false);
    })();
  }, [listingId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);
    setFile(null);
    setChecking(true);
    try {
      // Vérifier le poids
      if (picked.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`La vidéo est trop lourde (max ${MAX_SIZE_MB} Mo). Filmez plus court ou en qualité moindre.`);
        setChecking(false);
        return;
      }
      // Vérifier la durée
      const duration = await getVideoDuration(picked);
      if (duration > MAX_DURATION) {
        setError(`La vidéo dépasse 3 minutes (${Math.round(duration)} s). Merci de filmer une vidéo plus courte.`);
        setChecking(false);
        return;
      }
      setFile(picked);
    } catch {
      setError("Impossible de lire cette vidéo. Essayez un autre fichier.");
    }
    setChecking(false);
  }

  async function submit() {
    if (!file) {
      setError("Choisissez une vidéo.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitListingVerification(listingId, file);
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

  // En attente ou tout juste soumis
  if (done || status === "en_attente") {
    return (
      <div className="relative flex flex-col">
        <Link href="/my-listings" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <ScreenHeader title="Vérification du logement" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-pending-bg">
            <Icon name="hourglass_top" size={30} className="text-pending-text" />
          </span>
          <h2 className="text-base font-bold">Vidéo en cours d&apos;examen</h2>
          <p className="text-sm text-muted-foreground">
            Votre vidéo a bien été reçue. Notre équipe la vérifie, et le badge « Logement vérifié » apparaîtra une fois validée.
          </p>
          <Button variant="outline" size="lg" className="mt-2" onClick={() => router.push("/my-listings")}>
            Retour à mes annonces
          </Button>
        </div>
      </div>
    );
  }

  if (status === "validee") {
    return (
      <div className="relative flex flex-col">
        <Link href="/my-listings" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <ScreenHeader title="Vérification du logement" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-seal-bg">
            <Icon name="verified" size={30} className="text-seal-text" />
          </span>
          <h2 className="text-base font-bold">Logement vérifié</h2>
          <p className="text-sm text-muted-foreground">
            Ce logement a été vérifié. Le badge « Logement vérifié » est actif sur votre annonce.
          </p>
          <Button variant="outline" size="lg" className="mt-2" onClick={() => router.push("/my-listings")}>
            Retour à mes annonces
          </Button>
        </div>
      </div>
    );
  }

  // aucune ou rejetee : formulaire
  return (
    <div className="relative flex flex-col pb-8">
      <Link href="/my-listings" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader
        title="Faire vérifier ce logement"
        subtitle="Obtenez le badge de confiance en filmant votre bien."
      />

      <div className="space-y-5 px-5">
        {status === "rejetee" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-bold text-destructive">Vidéo précédente rejetée</p>
            {rejectionReason && <p className="mt-0.5 text-xs text-muted-foreground">Motif : {rejectionReason}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Vous pouvez soumettre une nouvelle vidéo.</p>
          </div>
        )}

        {/* Instructions de tournage */}
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icon name="videocam" size={20} className="text-accent" /> Comment filmer votre logement
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok-text" /> Filmez toutes les pièces (salon, chambres, cuisine, salle d&apos;eau).</li>
            <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok-text" /> Filmez en continu, sans coupure, pour montrer que tout est réel.</li>
            <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok-text" /> Montrez l&apos;extérieur et l&apos;entrée du bâtiment.</li>
            <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-ok-text" /> Une bonne lumière, un rythme lent : on doit bien voir.</li>
            <li className="flex gap-2"><Icon name="schedule" size={15} className="mt-0.5 shrink-0 text-accent" /> Durée maximale : 3 minutes.</li>
            <li className="flex gap-2 font-semibold text-seal-text">
              <Icon name="thumb_up" size={15} className="mt-0.5 shrink-0" /> Important : terminez la vidéo en filmant votre main faisant un pouce levé 👍. C&apos;est votre preuve que la vidéo est authentique et filmée par vous.
            </li>
          </ul>
        </div>

        {/* Confidentialité */}
        <div className="rounded-xl bg-secondary/60 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="lock" size={18} className="text-accent" /> Comment cette vidéo est utilisée
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Votre vidéo sert uniquement à notre équipe pour vérifier que le logement existe et correspond à l&apos;annonce. Elle est stockée de manière sécurisée, n&apos;est pas rendue publique, et n&apos;est pas visible par les locataires.
          </p>
        </div>

        {/* Sélection de la vidéo */}
        <div>
          <label className="field-label">Votre vidéo</label>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={checking}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/50 py-8 text-center"
          >
            <Icon
              name={file ? "check_circle" : "video_call"}
              size={28}
              className={file ? "text-ok-text" : "text-muted-foreground"}
              filled={false}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {checking ? "Vérification de la vidéo..." : file ? file.name : "Choisir ou filmer une vidéo"}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={onPick}
            className="hidden"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button size="lg" className="w-full" onClick={submit} disabled={submitting || checking || !file}>
          {submitting ? "Envoi..." : "Soumettre pour vérification"}
        </Button>
      </div>
    </div>
  );
}