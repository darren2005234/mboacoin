import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Avatar } from "@/components/mboacoin/avatar";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import { priceSuffixFor } from "@/lib/price-period";
import { nextUnpaidDueDate, todayIso, daysUntil, COVERAGE_ENDING_SOON_DAYS } from "@/lib/lease-schedule";
import { currentRenewalIntent } from "@/lib/lease-renewal-intent";
import { createClient } from "@/lib/supabase/server";
import { TenantLeaseActions } from "@/components/mboacoin/tenant-lease-actions";
import { RenewalIntentPrompt } from "@/components/mboacoin/renewal-intent-prompt";
import { PushOptInCard } from "@/components/mboacoin/push-opt-in-card";
import { loginUrl } from "@/lib/auth-redirect";

interface LeaseDetailRow {
  id: string;
  listing_id: string;
  landlord_id: string;
  start_date: string;
  duration_months: number | null;
  end_date: string | null;
  rent_amount: number;
  deposit_amount: number | null;
  advance_amount: number | null;
  payment_day: number | null;
  payment_period: string;
  payment_mode: string;
  listing: { title: string; image_url: string | null; city: string; neighborhood: string | null } | { title: string; image_url: string | null; city: string; neighborhood: string | null }[] | null;
  landlord: { full_name: string | null; avatar_url: string | null; verification: string } | { full_name: string | null; avatar_url: string | null; verification: string }[] | null;
}

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opt_in?: string }>;
}) {
  const { id } = await params;
  const { opt_in: optIn } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginUrl(`/my-lease/${id}`));

  const { data } = await supabase
    .from("leases")
    .select(
      "id, listing_id, landlord_id, start_date, duration_months, end_date, rent_amount, deposit_amount, advance_amount, payment_day, payment_period, payment_mode, listing:listings(title, image_url, city, neighborhood), landlord:profiles!landlord_id(full_name, avatar_url, verification)"
    )
    .eq("id", id)
    .eq("tenant_id", user.id)
    .eq("status", "actif")
    .maybeSingle();

  const row = data as LeaseDetailRow | null;
  if (!row) redirect("/my-lease");

  const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
  const landlord = Array.isArray(row.landlord) ? row.landlord[0] : row.landlord;

  const { data: paymentRows } = await supabase
    .from("lease_payments")
    .select("id, period, amount, paid_at, receipt_number, payment_batch_id")
    .eq("lease_id", row.id)
    .order("period", { ascending: false });
  const payments = paymentRows ?? [];

  const today = todayIso();
  const paidPeriods = new Set(payments.map((p) => p.period));
  // Prochaine échéance = première période sans paiement enregistré, en
  // croisant TOUS les paiements du bail (voir lib/lease-schedule.ts) — même
  // source de vérité que l'espace bailleur et le badge À jour/En retard.
  const dueDate =
    row.payment_mode === "avance"
      ? null
      : nextUnpaidDueDate(row.start_date, row.payment_day, row.payment_period, paidPeriods);
  // En mode avance, il n'y a jamais de retard : soit la période est
  // couverte, soit le bail arrive à son terme (voir la bannière dédiée).
  const isLate = row.payment_mode !== "avance" && dueDate !== null && dueDate < today;

  // Intention de renouvellement (mode avance) : question posée dès J-60,
  // modifiable jusqu'à l'échéance — voir components/mboacoin/renewal-intent-prompt.tsx.
  const remaining = row.payment_mode === "avance" && row.end_date ? daysUntil(row.end_date) : null;
  const showRenewalPrompt = remaining !== null && remaining <= COVERAGE_ENDING_SOON_DAYS;
  let renewalIntent: "reste" | "part" | null = null;
  if (showRenewalPrompt) {
    const { data: renewalRow } = await supabase
      .from("lease_renewal_intents")
      .select("intent, coverage_end_date, responded_at, updated_at")
      .eq("lease_id", row.id)
      .order("coverage_end_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    renewalIntent = renewalRow
      ? currentRenewalIntent(row.end_date, {
          intent: renewalRow.intent as "reste" | "part",
          coverageEndDate: renewalRow.coverage_end_date,
          respondedAt: renewalRow.responded_at,
          updatedAt: renewalRow.updated_at,
        })
      : null;
  }

  const { data: amendmentRow } = await supabase
    .from("lease_amendments")
    .select("id, reason, new_rent_amount, new_deposit_amount, new_advance_amount, new_payment_day, new_end_date")
    .eq("lease_id", row.id)
    .eq("status", "en_attente")
    .maybeSingle();

  const { data: requestRows } = await supabase
    .from("lease_requests")
    .select("id, status")
    .eq("lease_id", row.id);
  const requests = requestRows ?? [];
  const openRequests = requests.filter((r) => r.status === "nouvelle" || r.status === "en_cours").length;

  const { data: inspectionRows } = await supabase
    .from("etat_des_lieux")
    .select("type, status")
    .eq("lease_id", row.id);
  const inspectionEntree = (inspectionRows ?? []).find((i) => i.type === "entree") ?? null;
  const inspectionSortie = (inspectionRows ?? []).find((i) => i.type === "sortie") ?? null;

  const { data: documentRows } = await supabase
    .from("lease_documents")
    .select("storage_path")
    .eq("lease_id", row.id)
    .eq("document_type", "contrat")
    .order("created_at", { ascending: false })
    .limit(1);
  const contractPath = documentRows?.[0]?.storage_path ?? null;
  let contractUrl: string | null = null;
  if (contractPath) {
    const { data: signed } = await supabase.storage.from("lease-contracts").createSignedUrl(contractPath, 3600);
    contractUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Ma location" />

      {optIn === "lease_confirmed" && <PushOptInCard context="lease_confirmed" />}

      <div className="space-y-4 px-5">
        {/* Logement */}
        <Link href={`/listings/${row.listing_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            <Image src={listing?.image_url ?? "/img/listings/demo-1.jpg"} alt="" fill className="object-cover" sizes="64px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold">{listing?.title ?? "Logement"}</p>
            <p className="text-xs text-muted-foreground">
              {[listing?.neighborhood, listing?.city].filter(Boolean).join(", ")}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-accent">Voir la fiche</p>
          </div>
        </Link>

        {/* Bailleur */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <Avatar name={landlord?.full_name ?? "Bailleur"} src={landlord?.avatar_url} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{landlord?.full_name ?? "Bailleur"}</p>
            {landlord?.verification === "verifie" && <TrustSealBadge label="Bailleur vérifié" className="mt-0.5" />}
          </div>
        </div>

        {/* Conditions du bail */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Conditions du bail</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="Début" value={new Date(row.start_date).toLocaleDateString("fr-FR")} />
            <Info
              label="Durée"
              value={row.duration_months ? `${row.duration_months} mois` : "Indéterminée"}
            />
            {row.end_date && <Info label="Fin prévue" value={new Date(row.end_date).toLocaleDateString("fr-FR")} />}
            <Info label="Loyer" value={<Price amount={row.rent_amount} suffix={priceSuffixFor(row.payment_period)} size="sm" />} />
            {row.deposit_amount ? <Info label="Caution" value={<Price amount={row.deposit_amount} size="sm" />} /> : null}
            {row.advance_amount ? <Info label="Avance" value={<Price amount={row.advance_amount} size="sm" />} /> : null}
            {row.payment_day ? <Info label="Jour de paiement" value={String(row.payment_day)} /> : null}
            {row.payment_period === "mensuel" && (
              <Info label="Mode de paiement" value={row.payment_mode === "avance" ? "Avance" : "Mensuel"} />
            )}
          </div>
        </div>

        {/* Modification proposée / résiliation */}
        <TenantLeaseActions
          leaseId={row.id}
          currentRentAmount={row.rent_amount}
          currentDepositAmount={row.deposit_amount}
          currentAdvanceAmount={row.advance_amount}
          currentPaymentDay={row.payment_day}
          currentEndDate={row.end_date}
          amendment={
            amendmentRow
              ? {
                  id: amendmentRow.id,
                  reason: amendmentRow.reason,
                  newRentAmount: amendmentRow.new_rent_amount,
                  newDepositAmount: amendmentRow.new_deposit_amount,
                  newAdvanceAmount: amendmentRow.new_advance_amount,
                  newPaymentDay: amendmentRow.new_payment_day,
                  newEndDate: amendmentRow.new_end_date,
                }
              : null
          }
        />

        {/* Prochaine échéance / couverture */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="icon-badge size-11">
            <Icon name="event" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            {row.payment_mode === "avance" ? (
              <>
                <p className="text-sm font-bold">
                  {row.end_date
                    ? `Loyer payé jusqu'au ${new Date(row.end_date).toLocaleDateString("fr-FR")}`
                    : "Aucune période payée pour l'instant"}
                </p>
                <p className="text-xs text-muted-foreground">Paiement d&apos;avance</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold">
                  {dueDate
                    ? `Prochain loyer dû le ${new Date(dueDate).toLocaleDateString("fr-FR")}`
                    : "Facturation quotidienne"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.payment_period === "journalier" ? "Périodicité journalière" : "Périodicité mensuelle"}
                </p>
              </>
            )}
          </div>
          {isLate && (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              En retard
            </span>
          )}
        </div>

        {/* Intention de renouvellement (mode avance, à l'approche de la fin de couverture) */}
        {showRenewalPrompt && row.end_date && (
          <RenewalIntentPrompt
            leaseId={row.id}
            endDate={row.end_date}
            editable={remaining !== null && remaining >= 0}
            initialIntent={renewalIntent}
          />
        )}

        {/* Historique des paiements */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Historique des paiements</p>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun paiement enregistré pour l&apos;instant.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div>
                    <p className="text-xs font-bold capitalize">
                      {new Date(p.period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Payé le {new Date(p.paid_at).toLocaleDateString("fr-FR")} · <Price amount={p.amount} size="sm" />
                      {p.payment_batch_id && " · versement groupé"}
                    </p>
                  </div>
                  <a
                    href={`/api/receipts/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
                  >
                    Quittance
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demandes */}
        <Link
          href={`/my-lease/${row.id}/requests`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
        >
          <span className="icon-badge size-11">
            <Icon name="handyman" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Mes demandes</p>
            <p className="text-xs text-muted-foreground">
              {requests.length === 0
                ? "Réparation, question, démarche..."
                : `${requests.length} demande(s)${openRequests > 0 ? `, ${openRequests} en cours` : ""}`}
            </p>
          </div>
          <Icon name="chevron_right" size={20} className="text-muted-foreground" />
        </Link>

        {/* État des lieux */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">État des lieux</p>
          <Link
            href={`/my-lease/${row.id}/inspections/entree`}
            className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs font-bold"
          >
            Entrée
            <InspectionStatusBadge status={inspectionEntree?.status ?? null} />
          </Link>
          {inspectionSortie && (
            <Link
              href={`/my-lease/${row.id}/inspections/sortie`}
              className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs font-bold"
            >
              Sortie
              <InspectionStatusBadge status={inspectionSortie.status} />
            </Link>
          )}
        </div>

        {/* Contrat de bail */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Contrat de bail</p>
          {contractUrl ? (
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-accent"
            >
              <Icon name="description" size={16} /> Consulter le contrat
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Votre bailleur n&apos;a pas encore ajouté le contrat.</p>
          )}
        </div>
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

function InspectionStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    brouillon: { label: "À venir", cls: "bg-card text-muted-foreground" },
    soumis: { label: "À valider", cls: "bg-pending-bg text-pending-text" },
    conteste: { label: "Contesté", cls: "bg-destructive/10 text-destructive" },
    valide: { label: "Validé", cls: "bg-ok-bg text-ok-text" },
  };
  const s = status ? map[status] ?? { label: status, cls: "bg-card text-muted-foreground" } : { label: "Pas encore créé", cls: "bg-card text-muted-foreground" };
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
