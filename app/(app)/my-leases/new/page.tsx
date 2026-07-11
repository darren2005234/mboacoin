"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { PhoneField } from "@/components/mboacoin/phone-field";
import { Button } from "@/components/ui/button";
import { PRICE_PERIOD_LABELS, PRICE_PERIODS } from "@/lib/price-period";
import { getMyLeasableListings, createLease, type LeasableListing } from "@/lib/leases";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

export default function NewLeasePage() {
  const router = useRouter();
  const [listings, setListings] = useState<LeasableListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  const [listingId, setListingId] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [indeterminate, setIndeterminate] = useState(false);
  const [durationMonths, setDurationMonths] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [paymentPeriod, setPaymentPeriod] = useState<string>("mensuel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyLeasableListings().then((data) => {
      setListings(data);
      setLoadingListings(false);
      if (data.length === 1) {
        setListingId(data[0].id);
        setPaymentPeriod(data[0].pricePeriod);
        setRentAmount(String(data[0].price));
      }
    });
  }, []);

  function onSelectListing(id: string) {
    setListingId(id);
    const listing = listings.find((l) => l.id === id);
    if (listing) {
      setPaymentPeriod(listing.pricePeriod);
      setRentAmount((prev) => prev || String(listing.price));
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!listingId) {
      setError("Choisissez un logement.");
      return;
    }
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

    setLoading(true);
    const result = await createLease({
      listingId,
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
      setLoading(false);
      return;
    }
    router.push("/my-leases");
  }

  if (!loadingListings && listings.length === 0) {
    return (
      <div className="flex flex-col">
        <ScreenHeader title="Nouveau bail" />
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <p className="text-sm font-bold">Vous n&apos;avez aucun logement publié</p>
          <p className="text-xs text-muted-foreground">
            Un bail ne peut être créé que sur une annonce publiée.
          </p>
          <button
            onClick={() => router.push("/publish")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
          >
            Publier une annonce
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Nouveau bail" subtitle="Enregistrez un locataire sur un de vos logements." />

      <p className="px-5 pb-1 text-xs text-muted-foreground">
        Les champs marqués d&apos;un <span className="text-destructive">*</span> sont obligatoires.
      </p>

      <form onSubmit={submit} className="space-y-6 px-5">
        <div>
          <label htmlFor="listing" className="field-label">
            Logement<span className="text-destructive"> *</span>
          </label>
          <select
            id="listing"
            value={listingId}
            onChange={(e) => onSelectListing(e.target.value)}
            className={inputCls}
            disabled={loadingListings}
          >
            <option value="">Sélectionnez un logement</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} — {[l.neighborhood, l.city].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">
            Téléphone du locataire<span className="text-destructive"> *</span>
          </label>
          <PhoneField value={tenantPhone} onChange={setTenantPhone} />
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

        <Button type="submit" size="lg" className="w-full" disabled={loading || loadingListings}>
          {loading ? "Création en cours..." : "Créer le bail"}
        </Button>
      </form>
    </div>
  );
}
