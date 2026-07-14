"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import {
  getMyDeletionStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
} from "@/lib/account-deletion";
import { useRequireAuth } from "@/lib/use-require-auth";

/**
 * Demande de suppression de compte. Le consentement doit être éclairé, pas
 * tacite : les deux limites de la pseudonymisation (documents à valeur
 * probante accessibles à l'autre partie, contenu de fichier non réécrivable)
 * sont affichées AVANT la case à cocher, jamais découvertes après coup.
 */
export default function DeleteAccountPage() {
  const { ready } = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const status = await getMyDeletionStatus();
    setPending(status.pending);
    setScheduledFor(status.scheduledFor);
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function submit() {
    setError(null);
    setBusy(true);
    const result = await requestAccountDeletion();
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  async function cancel() {
    setError(null);
    setBusy(true);
    const result = await cancelAccountDeletion();
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }

  if (!ready || loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/profile/settings" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Supprimer mon compte" />

      <div className="space-y-4 px-5">
        {pending ? (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-destructive/10">
                <Icon name="hourglass_top" size={20} className="text-destructive" filled={false} />
              </span>
              <div>
                <p className="text-sm font-bold">Suppression prévue</p>
                <p className="text-xs text-muted-foreground">
                  {scheduledFor && `Le ${new Date(scheduledFor).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Votre compte est suspendu en attendant : vos annonces ne sont plus visibles, et vous ne pouvez plus
              créer de nouveau bail ou annonce. Vous pouvez annuler à tout moment avant cette date.
            </p>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button variant="outline" size="lg" className="w-full" onClick={cancel} disabled={busy}>
              {busy ? "..." : "Annuler la suppression"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-bold">Ce qui sera supprimé</p>
              <p className="text-xs text-muted-foreground">
                Votre profil (nom, photo, téléphone, email), vos annonces, vos favoris, votre historique de
                consultation, vos conversations, vos tickets de support et vos abonnements aux notifications.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-pending-bg bg-pending-bg/40 p-4">
              <p className="text-sm font-bold">Avant de continuer, deux choses à savoir</p>
              <p className="text-xs text-muted-foreground">
                Les documents qui engagent aussi les droits d&apos;une autre personne — quittances, états des lieux,
                contrat de bail — restent accessibles au bailleur ou au locataire concerné. Ce n&apos;est pas un
                oubli : cette personne a besoin de pouvoir prouver que la location a bien eu lieu, même après votre
                départ. Votre nom y est remplacé par « Utilisateur supprimé » partout où c&apos;est possible.
              </p>
              <p className="text-xs text-muted-foreground">
                Cette limite ne s&apos;applique cependant pas aux fichiers déjà scannés ou photographiés — un
                contrat scanné, des photos d&apos;état des lieux. Si votre nom apparaît écrit dans l&apos;image
                elle-même, nous ne pouvons pas modifier ce contenu : c&apos;est un document déjà établi entre les
                deux parties, tel qu&apos;il a été signé.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-bold">Avant de pouvoir supprimer votre compte</p>
              <p className="text-xs text-muted-foreground">
                Tous vos baux doivent être terminés (aucun actif, ni en attente de confirmation), et aucune visite
                confirmée ne doit être à venir. La demande sera refusée sinon, avec une explication.
              </p>
            </div>

            <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-card">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-xs leading-relaxed">
                J&apos;ai compris ces limites et je confirme vouloir supprimer mon compte. Je pourrai annuler
                pendant 7 jours.
              </span>
            </label>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <Button
              variant="outline"
              size="lg"
              className="w-full text-destructive"
              onClick={submit}
              disabled={!confirmed || busy}
            >
              {busy ? "..." : "Supprimer mon compte"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
