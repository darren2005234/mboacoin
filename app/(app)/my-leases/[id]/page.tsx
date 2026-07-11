"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { Button } from "@/components/ui/button";
import { priceSuffixFor } from "@/lib/price-period";
import { getMyLeaseById, type MyLease } from "@/lib/leases";
import { getLeaseSchedule, declarePayment, type DueInstallment } from "@/lib/lease-payments";

const dateInputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

export default function LandlordLeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [lease, setLease] = useState<MyLease | null>(null);
  const [schedule, setSchedule] = useState<DueInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [freePeriod, setFreePeriod] = useState("");
  const [freePaidAt, setFreePaidAt] = useState("");

  async function refresh() {
    const l = await getMyLeaseById(id);
    if (!l) {
      router.push("/my-leases");
      return;
    }
    setLease(l);
    if (l.paymentPeriod === "mensuel") {
      setSchedule(await getLeaseSchedule(l));
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function markPaid(period: string, paidAt: string) {
    setError(null);
    setBusy(period);
    const result = await declarePayment(id, period, paidAt);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    await refresh();
    setBusy(null);
  }

  async function declareFree(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!freePeriod || !freePaidAt) {
      setError("Indiquez la période et la date de paiement.");
      return;
    }
    setBusy("free");
    const result = await declarePayment(id, freePeriod, freePaidAt);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setFreePeriod("");
    setFreePaidAt("");
    await refresh();
    setBusy(null);
  }

  if (loading || !lease) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title={lease.listingTitle} subtitle={lease.tenantName ?? lease.tenantPhone} />

      <div className="space-y-4 px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            <Image src={lease.listingImage} alt="" fill className="object-cover" sizes="64px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold">{lease.listingTitle}</p>
            <p className="text-xs text-muted-foreground">
              {lease.tenantName ?? "Locataire non rattaché"} · {lease.tenantPhone}
            </p>
            <Price amount={lease.rentAmount} suffix={priceSuffixFor(lease.paymentPeriod)} size="sm" className="mt-1" />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {lease.paymentPeriod === "mensuel" ? (
          <div className="space-y-2">
            <p className="px-1 text-sm font-bold">Échéances</p>
            {schedule.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Aucune échéance pour l&apos;instant.</p>
            ) : (
              schedule.map((installment) => (
                <InstallmentRow
                  key={installment.period}
                  installment={installment}
                  busy={busy === installment.period}
                  onMarkPaid={markPaid}
                />
              ))
            )}
          </div>
        ) : (
          <form onSubmit={declareFree} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">Déclarer un paiement</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="freePeriod">
                  Période
                </label>
                <input
                  id="freePeriod"
                  type="date"
                  value={freePeriod}
                  onChange={(e) => setFreePeriod(e.target.value)}
                  className={dateInputCls}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="freePaidAt">
                  Date de paiement
                </label>
                <input
                  id="freePaidAt"
                  type="date"
                  value={freePaidAt}
                  onChange={(e) => setFreePaidAt(e.target.value)}
                  className={dateInputCls}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy === "free"}>
              {busy === "free" ? "..." : "Marquer payé"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function InstallmentRow({
  installment,
  busy,
  onMarkPaid,
}: {
  installment: DueInstallment;
  busy: boolean;
  onMarkPaid: (period: string, paidAt: string) => void;
}) {
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const label = new Date(installment.period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
      <div>
        <p className="text-sm font-bold capitalize">{label}</p>
        {installment.paid ? (
          <p className="text-xs text-muted-foreground">
            Payé le {new Date(installment.paid.paidAt).toLocaleDateString("fr-FR")}
          </p>
        ) : installment.late ? (
          <p className="text-xs font-semibold text-destructive">En retard</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Dû le {new Date(installment.period).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>
      {installment.paid ? (
        <a
          href={`/api/receipts/${installment.paid.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
        >
          Quittance
        </a>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-32 rounded-lg border border-input bg-card px-2 py-1.5 text-xs outline-none"
          />
          <button
            onClick={() => onMarkPaid(installment.period, paidAt)}
            disabled={busy}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "..." : "Payé"}
          </button>
        </div>
      )}
    </div>
  );
}
