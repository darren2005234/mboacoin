"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resiliateLease } from "@/lib/leases";
import { respondToAmendment } from "@/lib/lease-amendments";

export interface PendingAmendmentInfo {
  id: string;
  reason: string | null;
  newRentAmount: number | null;
  newDepositAmount: number | null;
  newAdvanceAmount: number | null;
  newPaymentDay: number | null;
  newEndDate: string | null;
}

interface TenantLeaseActionsProps {
  leaseId: string;
  currentRentAmount: number;
  currentDepositAmount: number | null;
  currentAdvanceAmount: number | null;
  currentPaymentDay: number | null;
  currentEndDate: string | null;
  amendment: PendingAmendmentInfo | null;
}

export function TenantLeaseActions({
  leaseId,
  currentRentAmount,
  currentDepositAmount,
  currentAdvanceAmount,
  currentPaymentDay,
  currentEndDate,
  amendment,
}: TenantLeaseActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResiliate, setShowResiliate] = useState(false);
  const [reason, setReason] = useState("");

  async function onRespond(accept: boolean) {
    if (!amendment) return;
    setError(null);
    setBusy(accept ? "accept" : "refuse");
    const result = await respondToAmendment(amendment.id, accept);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  async function onResiliate() {
    setError(null);
    setBusy("resiliate");
    const result = await resiliateLease(leaseId, reason);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  const rows: { label: string; oldValue: string; newValue: string }[] = [];
  if (amendment?.newRentAmount != null) {
    rows.push({ label: "Loyer", oldValue: `${currentRentAmount} FCFA`, newValue: `${amendment.newRentAmount} FCFA` });
  }
  if (amendment?.newDepositAmount != null) {
    rows.push({
      label: "Caution",
      oldValue: `${currentDepositAmount ?? 0} FCFA`,
      newValue: `${amendment.newDepositAmount} FCFA`,
    });
  }
  if (amendment?.newAdvanceAmount != null) {
    rows.push({
      label: "Avance",
      oldValue: `${currentAdvanceAmount ?? 0} FCFA`,
      newValue: `${amendment.newAdvanceAmount} FCFA`,
    });
  }
  if (amendment?.newPaymentDay != null) {
    rows.push({
      label: "Jour de paiement",
      oldValue: String(currentPaymentDay ?? "—"),
      newValue: String(amendment.newPaymentDay),
    });
  }
  if (amendment?.newEndDate != null) {
    rows.push({
      label: "Fin du bail",
      oldValue: currentEndDate ? new Date(currentEndDate).toLocaleDateString("fr-FR") : "Indéterminée",
      newValue: new Date(amendment.newEndDate).toLocaleDateString("fr-FR"),
    });
  }

  return (
    <div className="space-y-4">
      {amendment && (
        <div className="space-y-2 rounded-2xl border border-pending-bg bg-pending-bg/40 p-4 shadow-card">
          <p className="text-sm font-bold">Votre bailleur propose de modifier les conditions</p>
          <div className="space-y-1">
            {rows.map((r) => (
              <p key={r.label} className="text-xs">
                <span className="text-muted-foreground">{r.label} : </span>
                {r.oldValue} → <span className="font-bold">{r.newValue}</span>
              </p>
            ))}
            {amendment.reason && <p className="text-xs text-muted-foreground">Motif : {amendment.reason}</p>}
          </div>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onRespond(false)}
              disabled={busy !== null}
              className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              {busy === "refuse" ? "..." : "Refuser"}
            </button>
            <button
              onClick={() => onRespond(true)}
              disabled={busy !== null}
              className="flex-1 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy === "accept" ? "..." : "Accepter"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
        {!amendment && error && <p className="text-xs font-medium text-destructive">{error}</p>}
        {showResiliate ? (
          <div className="space-y-2">
            <label className="field-label">Motif (facultatif)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Ex : déménagement"
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowResiliate(false)}
                className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                onClick={onResiliate}
                disabled={busy === "resiliate"}
                className="flex-1 rounded-full bg-destructive px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === "resiliate" ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowResiliate(true)}
            className="w-full rounded-full bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive"
          >
            Résilier le bail
          </button>
        )}
      </div>
    </div>
  );
}
