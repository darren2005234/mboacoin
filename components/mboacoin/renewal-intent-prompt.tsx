"use client";

import { useState } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { setMyRenewalIntent } from "@/lib/lease-renewal-intent";

/**
 * Question posée au locataire à l'approche de la fin de sa période payée
 * (mode avance) : ce n'est pas un rappel de paiement, ça appelle une
 * réponse. Modifiable tant que la période n'est pas échue (editable=false
 * au-delà : lecture seule). L'absence de réponse n'est jamais traitée comme
 * un départ — voir set_lease_renewal_intent (20260715160000).
 */
export function RenewalIntentPrompt({
  leaseId,
  endDate,
  editable,
  initialIntent,
}: {
  leaseId: string;
  endDate: string;
  editable: boolean;
  initialIntent: "reste" | "part" | null;
}) {
  const [intent, setIntent] = useState(initialIntent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = new Date(endDate).toLocaleDateString("fr-FR");

  async function answer(next: "reste" | "part") {
    if (busy || intent === next) return;
    setBusy(true);
    setError(null);
    const result = await setMyRenewalIntent(leaseId, next);
    if (result.error) setError(result.error);
    else setIntent(next);
    setBusy(false);
  }

  if (!editable) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-sm font-bold">Période payée jusqu&apos;au {label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {intent === "reste"
            ? "Vous aviez indiqué vouloir rester."
            : intent === "part"
              ? "Vous aviez indiqué vouloir partir."
              : "Vous n'aviez pas répondu — contactez votre bailleur."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-pending-bg bg-pending-bg/40 p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="icon-badge size-11">
          <Icon name="help" size={20} filled={false} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Votre période s&apos;achève le {label}</p>
          <p className="text-xs text-muted-foreground">Comptez-vous rester ?</p>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => answer("reste")}
          disabled={busy}
          className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${
            intent === "reste" ? "bg-primary text-primary-foreground" : "bg-secondary"
          }`}
        >
          Je reste
        </button>
        <button
          onClick={() => answer("part")}
          disabled={busy}
          className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${
            intent === "part" ? "bg-destructive text-white" : "bg-secondary"
          }`}
        >
          Je pars
        </button>
      </div>

      {intent && (
        <p className="text-center text-[11px] text-muted-foreground">
          Vous pouvez changer d&apos;avis jusqu&apos;au {label}.
        </p>
      )}
    </div>
  );
}
