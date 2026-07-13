"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { PhoneField } from "@/components/mboacoin/phone-field";
import { Button } from "@/components/ui/button";
import { PRICE_PERIOD_LABELS, PRICE_PERIODS } from "@/lib/price-period";
import { getMyLeaseById, updatePendingLease, type MyLease } from "@/lib/leases";
import { useRequireAuth } from "@/lib/use-require-auth";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

export default function EditLeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [lease, setLease] = useState<MyLease | null>(null);
  const [loading, setLoading] = useState(true);

  const [tenantPhone, setTenantPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [indeterminate, setIndeterminate] = useState(false);
  const [durationMonths, setDurationMonths] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [paymentPeriod, setPaymentPeriod] = useState("mensuel");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    getMyLeaseById(id).then((l) => {
      if (!l || l.status !== "en_attente_confirmation") {
        router.push(`/my-leases/${id}`);
        return;
      }
      setLease(l);
      setTenantPhone(l.tenantPhone);
      setStartDate(l.startDate);
      setIndeterminate(l.durationMonths === null);
      setDurationMonths(l.durationMonths ? String(l.durationMonths) : "");
      setRentAmount(String(l.rentAmount));
      setDepositAmount(l.depositAmount ? String(l.depositAmount) : "");
      setAdvanceAmount(l.advanceAmount ? String(l.advanceAmount) : "");
      setPaymentDay(l.paymentDay ? String(l.paymentDay) : "");
      setPaymentPeriod(l.paymentPeriod);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!tenantPhone) {
      setError("Le numéro du locataire est obligatoire.");
      return;
    }
    if (!startDate) {
      setError("La date de début est obligatoire.");
      return;
    }
    const rent = Number(rentAmount);
    if (!rent || rent <= 0) {
      setError("Le loyer doit être un montant valide.");
      return;
    }

    setSaving(true);
    const result = await updatePendingLease(id, {
      tenantPhone,
      startDate,
      durationMonths: indeterminate ? null : durationMonths ? Number(durationMonths) : null,
      rentAmount: rent,
      depositAmount: depositAmount ? Number(depositAmount) : null,
      advanceAmount: advanceAmount ? Number(advanceAmount) : null,
      paymentDay: paymentDay ? Number(paymentDay) : null,
      paymentPeriod,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/my-leases/${id}`);
  }

  if (loading || !lease) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader
        title="Modifier le bail"
        subtitle="Le bail n'est pas encore confirmé : vous pouvez encore tout corriger."
      />

      <form onSubmit={submit} className="space-y-6 px-5">
        <div>
          <label className="field-label">
            Téléphone du locataire<span className="text-destructive"> *</span>
          </label>
          <PhoneField value={tenantPhone} onChange={setTenantPhone} />
          <p className="mt-1 text-xs text-muted-foreground">
            Changer ce numéro annule le rattachement précédent : le bon locataire devra se reconnecter.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="startDate" className="field-label">
              Date de début<span className="text-destructive"> *</span>
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="duration" className="field-label">
              Durée (mois)
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
              disabled={indeterminate}
              placeholder="Ex : 12"
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={indeterminate}
            onChange={(e) => setIndeterminate(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Durée indéterminée
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rent" className="field-label">
              Loyer (FCFA)<span className="text-destructive"> *</span>
            </label>
            <input
              id="rent"
              type="number"
              min={0}
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="period" className="field-label">
              Périodicité<span className="text-destructive"> *</span>
            </label>
            <select
              id="period"
              value={paymentPeriod}
              onChange={(e) => setPaymentPeriod(e.target.value)}
              className={inputCls}
            >
              {PRICE_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PRICE_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="deposit" className="field-label">
              Caution (FCFA)
            </label>
            <input
              id="deposit"
              type="number"
              min={0}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="advance" className="field-label">
              Avance (FCFA)
            </label>
            <input
              id="advance"
              type="number"
              min={0}
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="paymentDay" className="field-label">
            Jour de paiement <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <input
            id="paymentDay"
            type="number"
            min={1}
            max={31}
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            placeholder="Ex : 5"
            className={inputCls}
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </form>
    </div>
  );
}
