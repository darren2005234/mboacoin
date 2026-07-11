"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Avatar } from "@/components/mboacoin/avatar";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Price } from "@/components/mboacoin/price";
import { Button } from "@/components/ui/button";
import { priceSuffixFor } from "@/lib/price-period";
import { getMyPendingLeases, confirmLease, rejectLease, type PendingLease } from "@/lib/leases";

export default function ConfirmLeasePage() {
  const router = useRouter();
  const [leases, setLeases] = useState<PendingLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLeases(await getMyPendingLeases());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onConfirm(leaseId: string) {
    setError(null);
    setBusy(leaseId);
    const result = await confirmLease(leaseId);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    router.push(`/my-lease/${leaseId}`);
  }

  async function onReject(leaseId: string) {
    setError(null);
    setBusy(leaseId);
    const result = await rejectLease(leaseId);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    await refresh();
    setBusy(null);
  }

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (leases.length === 0) {
    return (
      <div className="flex flex-col">
        <ScreenHeader title="Confirmation de bail" />
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <p className="text-sm font-bold">Aucun bail en attente</p>
          <button
            onClick={() => router.push("/explore")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader
        title="Confirmation de bail"
        subtitle="Un bailleur vous a enregistré comme locataire. Vérifiez les informations avant de confirmer."
      />

      <div className="space-y-4 px-5">
        {leases.map((lease) => (
          <div key={lease.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <Link href={`/listings/${lease.listingId}`} className="flex items-center gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <Image src={lease.listingImage} alt="" fill className="object-cover" sizes="64px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{lease.listingTitle}</p>
                <p className="text-xs text-muted-foreground">{lease.listingLocation}</p>
                <p className="mt-0.5 text-xs font-semibold text-accent">Voir la fiche</p>
              </div>
            </Link>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Avatar name={lease.landlord.fullName ?? "Bailleur"} src={lease.landlord.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{lease.landlord.fullName ?? "Bailleur"}</p>
                {lease.landlord.verified && <TrustSealBadge label="Bailleur vérifié" className="mt-0.5" />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <Info label="Début" value={new Date(lease.startDate).toLocaleDateString("fr-FR")} />
              <Info label="Durée" value={lease.durationMonths ? `${lease.durationMonths} mois` : "Indéterminée"} />
              <Info label="Loyer" value={<Price amount={lease.rentAmount} suffix={priceSuffixFor(lease.paymentPeriod)} size="sm" />} />
              {lease.depositAmount ? <Info label="Caution" value={<Price amount={lease.depositAmount} size="sm" />} /> : null}
              {lease.advanceAmount ? <Info label="Avance" value={<Price amount={lease.advanceAmount} size="sm" />} /> : null}
              {lease.paymentDay ? <Info label="Jour de paiement" value={String(lease.paymentDay)} /> : null}
            </div>

            <div className="flex gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                className="flex-1 text-destructive"
                disabled={busy === lease.id}
                onClick={() => onReject(lease.id)}
              >
                Non, pas moi
              </Button>
              <Button className="flex-1" disabled={busy === lease.id} onClick={() => onConfirm(lease.id)}>
                {busy === lease.id ? "..." : "Oui, je confirme"}
              </Button>
            </div>
          </div>
        ))}

        {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

        <button
          onClick={() => router.push("/explore")}
          className="w-full py-2 text-center text-sm font-semibold text-muted-foreground"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
