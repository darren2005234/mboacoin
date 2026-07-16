"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { reportListing, reportUser, REPORT_USER_REASONS } from "@/lib/reports";
import { loginUrl } from "@/lib/auth-redirect";

const LISTING_REASONS = [
  "Annonce frauduleuse / arnaque",
  "Fausses informations",
  "Bien déjà loué",
  "Photos trompeuses",
  "Contenu inapproprié",
  "Autre",
].map((label) => ({ value: label, label }));

interface ReportDialogProps {
  /** Type de cible : annonce ou utilisateur. */
  targetType: "listing" | "user";
  targetId: string;
  /** Libellé du bouton déclencheur. */
  label?: string;
}

export function ReportDialog({ targetType, targetId, label = "Signaler" }: ReportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = targetType === "listing" ? LISTING_REASONS : REPORT_USER_REASONS;

  async function submit() {
    if (!reason) {
      setError("Choisissez un motif.");
      return;
    }
    setError(null);
    setLoading(true);
    const result =
      targetType === "listing"
        ? await reportListing(targetId, reason, details)
        : await reportUser(targetId, reason, details);

    if (result.error === "not-authenticated") {
      router.push(loginUrl());
      return;
    }
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
      >
        <Icon name="flag" size={16} filled={false} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => !loading && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="icon-badge size-14">
                  <Icon name="check_circle" size={28} />
                </span>
                <p className="text-base font-bold">Signalement envoyé</p>
                <p className="text-sm text-muted-foreground">
                  Votre signalement a été transmis.
                </p>
                <Button size="lg" className="mt-2 w-full" onClick={() => { setOpen(false); setDone(false); setReason(""); setDetails(""); }}>
                  Fermer
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-extrabold">Signaler</h2>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">
                  Pourquoi souhaitez-vous signaler {targetType === "listing" ? "cette annonce" : "cet utilisateur"} ?
                </p>

                <div className="space-y-2">
                  {reasons.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={
                        reason === r.value
                          ? "flex w-full items-center justify-between rounded-xl border-2 border-accent bg-brand-50 px-4 py-3 text-left text-sm font-semibold"
                          : "flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium"
                      }
                    >
                      {r.label}
                      {reason === r.value && <Icon name="check" size={18} className="text-accent" />}
                    </button>
                  ))}
                </div>

                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Détails (optionnel)"
                  className="mt-3 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-accent"
                />

                {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}

                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="lg" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
                    Annuler
                  </Button>
                  <Button size="lg" className="flex-1" onClick={submit} disabled={loading}>
                    {loading ? "Envoi..." : "Envoyer"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}