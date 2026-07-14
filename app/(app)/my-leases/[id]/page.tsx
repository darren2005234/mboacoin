"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Button } from "@/components/ui/button";
import { priceSuffixFor } from "@/lib/price-period";
import { getMyLeaseById, addMonths, cancelPendingLease, endActiveLease, type MyLease } from "@/lib/leases";
import { getLeaseSchedule, declarePayment, declarePaymentBatch, type DueInstallment } from "@/lib/lease-payments";
import { nextPaymentDueDate, daysUntil } from "@/lib/lease-schedule";
import { getLeaseRequests, REQUEST_TYPE_LABELS, type LeaseRequestSummary } from "@/lib/lease-requests";
import { getLeaseDocuments, uploadLeaseContract, getContractSignedUrl } from "@/lib/lease-documents";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  getLeaseAmendments,
  proposeLeaseAmendment,
  cancelAmendment,
  type LeaseAmendment,
  type AmendmentPatch,
} from "@/lib/lease-amendments";
import { getInspectionsSummary, INSPECTION_STATUS_LABELS, type InspectionSummary } from "@/lib/property-inspections";

const dateInputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";
const smallInputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-ring/25";

const END_STATUS_LABELS: Record<string, string> = {
  termine: "Ce bail est arrivé à son terme",
  arrete: "Ce bail a été arrêté par le bailleur",
  resilie: "Ce bail a été résilié par le locataire",
  rejete: "Ce bail a été refusé par le locataire",
  annule: "Ce bail a été annulé",
};

export default function LandlordLeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [lease, setLease] = useState<MyLease | null>(null);
  const [schedule, setSchedule] = useState<DueInstallment[]>([]);
  const [requests, setRequests] = useState<LeaseRequestSummary[]>([]);
  const [amendments, setAmendments] = useState<LeaseAmendment[]>([]);
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [freePeriod, setFreePeriod] = useState("");
  const [freePaidAt, setFreePaidAt] = useState("");

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showEndForm, setShowEndForm] = useState(false);
  const [showAmendForm, setShowAmendForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);

  async function refresh() {
    const l = await getMyLeaseById(id);
    if (!l) {
      router.push("/my-leases");
      return;
    }
    setLease(l);
    if (l.status === "actif" && l.paymentPeriod === "mensuel" && l.paymentMode !== "avance") {
      setSchedule(await getLeaseSchedule(l));
    }
    setAmendments(await getLeaseAmendments(id));
    setInspections(await getInspectionsSummary(id));
    setRequests(await getLeaseRequests(id));
    const documents = await getLeaseDocuments(id);
    const contract = documents.find((d) => d.documentType === "contrat");
    setContractUrl(contract ? await getContractSignedUrl(contract.storagePath) : null);
    setLoading(false);
  }

  async function onUploadContract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingContract(true);
    setError(null);
    const result = await uploadLeaseContract(id, file);
    if (result.error) setError(result.error);
    await refresh();
    setUploadingContract(false);
  }

  useEffect(() => {
    if (!ready) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

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

  async function onDeclareBatch(startPeriod: string, months: number, paidAt: string) {
    setError(null);
    setBusy("batch");
    const result = await declarePaymentBatch({ leaseId: id, startPeriod, months, paidAt });
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setShowBatchForm(false);
    await refresh();
    setBusy(null);
  }

  async function onCancelLease() {
    setError(null);
    setBusy("cancel");
    const result = await cancelPendingLease(id, cancelReason);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setShowCancelForm(false);
    await refresh();
    setBusy(null);
  }

  async function onEndLease(status: "termine" | "arrete", reason: string) {
    setError(null);
    setBusy("end");
    const result = await endActiveLease(id, status, reason);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setShowEndForm(false);
    await refresh();
    setBusy(null);
  }

  async function onProposeAmendment(patch: AmendmentPatch, reason: string) {
    setError(null);
    setBusy("amend");
    const result = await proposeLeaseAmendment(id, patch, reason);
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setShowAmendForm(false);
    await refresh();
    setBusy(null);
  }

  async function onCancelAmendment(amendmentId: string) {
    setError(null);
    setBusy("cancel-amend");
    const result = await cancelAmendment(amendmentId);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(null);
  }

  if (loading || !lease) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  const dueDate = nextPaymentDueDate(lease.startDate, lease.paymentDay, lease.paymentPeriod);
  const isLate = lease.status === "actif" && schedule.some((i) => i.late);
  const remaining = lease.status === "actif" && lease.endDate ? daysUntil(lease.endDate) : null;
  const isEnded = ["termine", "arrete", "resilie", "rejete", "annule"].includes(lease.status);
  const pendingAmendment = amendments.find((a) => a.status === "en_attente") ?? null;
  const pastAmendments = amendments.filter((a) => a.status !== "en_attente");

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
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">
                {lease.tenantName ?? "Locataire non rattaché"} · {lease.tenantPhone}
              </p>
              {lease.tenantVerified && <TrustSealBadge label="Vérifié" />}
            </div>
            <Price amount={lease.rentAmount} suffix={priceSuffixFor(lease.paymentPeriod)} size="sm" className="mt-1" />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {/* Bail en attente : modifier ou annuler */}
        {lease.status === "en_attente_confirmation" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Link
                href={`/my-leases/${id}/edit`}
                className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-center text-xs font-bold"
              >
                Modifier
              </Link>
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                className="flex-1 rounded-full bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive"
              >
                Annuler ce bail
              </button>
            </div>
            {showCancelForm && (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
                <label className="field-label">Motif (facultatif)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="Ex : numéro injoignable"
                  className={smallInputCls}
                />
                <Button
                  onClick={onCancelLease}
                  disabled={busy === "cancel"}
                  variant="outline"
                  className="w-full text-destructive"
                >
                  {busy === "cancel" ? "..." : "Confirmer l'annulation"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Bail terminé/annulé/refusé : résumé */}
        {isEnded && (
          <div className="space-y-1 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">{END_STATUS_LABELS[lease.status] ?? "Bail clos"}</p>
            {lease.endedAt && (
              <p className="text-xs text-muted-foreground">
                Le {new Date(lease.endedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
            {lease.endReason && <p className="text-xs text-muted-foreground">Motif : {lease.endReason}</p>}
          </div>
        )}

        {/* Conditions du bail */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Conditions du bail</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="Début" value={new Date(lease.startDate).toLocaleDateString("fr-FR")} />
            <Info label="Durée" value={lease.durationMonths ? `${lease.durationMonths} mois` : "Indéterminée"} />
            {lease.endDate && (
              <Info label="Fin prévue" value={new Date(lease.endDate).toLocaleDateString("fr-FR")} />
            )}
            <Info
              label="Loyer"
              value={<Price amount={lease.rentAmount} suffix={priceSuffixFor(lease.paymentPeriod)} size="sm" />}
            />
            {lease.depositAmount ? (
              <Info label="Caution" value={<Price amount={lease.depositAmount} size="sm" />} />
            ) : null}
            {lease.advanceAmount ? (
              <Info label="Avance" value={<Price amount={lease.advanceAmount} size="sm" />} />
            ) : null}
            {lease.paymentDay ? <Info label="Jour de paiement" value={String(lease.paymentDay)} /> : null}
            {lease.paymentPeriod === "mensuel" && (
              <Info label="Mode de paiement" value={lease.paymentMode === "avance" ? "Avance" : "Mensuel"} />
            )}
          </div>
        </div>

        {/* Historique des propositions de modification (visible même après la fin du bail) */}
        {pastAmendments.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">Historique des propositions</p>
            {pastAmendments.map((a) => (
              <div key={a.id} className="space-y-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <AmendmentStatusBadge status={a.status} />
                <AmendmentDiff lease={lease} amendment={a} />
              </div>
            ))}
          </div>
        )}

        {lease.status === "actif" && (
          <>
            {/* Prochaine échéance / couverture */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <span className="icon-badge size-11">
                <Icon name="event" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                {lease.paymentMode === "avance" ? (
                  <>
                    <p className="text-sm font-bold">
                      {lease.endDate
                        ? `Couvert jusqu'au ${new Date(lease.endDate).toLocaleDateString("fr-FR")}`
                        : "Aucune période payée pour l'instant"}
                    </p>
                    <p className="text-xs text-muted-foreground">Paiement d&apos;avance</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold">
                      {dueDate ? `Prochain loyer dû le ${dueDate.toLocaleDateString("fr-FR")}` : "Facturation quotidienne"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lease.paymentPeriod === "journalier" ? "Périodicité journalière" : "Périodicité mensuelle"}
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

            {/* Alerte d'échéance / fin de couverture */}
            {remaining !== null && remaining <= 30 && (
              <div
                className={`flex items-center gap-3 rounded-2xl border p-4 shadow-card ${
                  remaining < 0 ? "border-destructive/30 bg-destructive/5" : "border-pending-bg bg-pending-bg/40"
                }`}
              >
                <Icon
                  name="warning"
                  size={20}
                  className={remaining < 0 ? "text-destructive" : "text-pending-text"}
                  filled={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {lease.paymentMode === "avance"
                      ? remaining < 0
                        ? "Période échue, non renouvelée"
                        : "La période payée se termine bientôt"
                      : remaining < 0
                        ? "Ce bail est arrivé à échéance"
                        : "Ce bail arrive bientôt à échéance"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lease.endDate && new Date(lease.endDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-right">
                  {lease.paymentMode === "avance" ? (
                    <button
                      onClick={() => setShowBatchForm(true)}
                      className="text-xs font-bold text-accent underline"
                    >
                      Déclarer un versement
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAmendForm(true)}
                      className="text-xs font-bold text-accent underline"
                    >
                      Prolonger
                    </button>
                  )}
                  <button
                    onClick={() => setShowEndForm(true)}
                    className="text-xs font-bold text-destructive underline"
                  >
                    Terminer
                  </button>
                </div>
              </div>
            )}

            {/* Modification des conditions */}
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-bold">Modification des conditions</p>
              {pendingAmendment ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-pending-text">
                    Proposition en attente de réponse du locataire
                  </p>
                  <AmendmentDiff lease={lease} amendment={pendingAmendment} />
                  <button
                    onClick={() => onCancelAmendment(pendingAmendment.id)}
                    disabled={busy === "cancel-amend"}
                    className="text-xs font-bold text-destructive underline disabled:opacity-50"
                  >
                    Annuler la proposition
                  </button>
                </div>
              ) : showAmendForm ? (
                <AmendForm
                  lease={lease}
                  onSubmit={onProposeAmendment}
                  onCancel={() => setShowAmendForm(false)}
                  busy={busy === "amend"}
                />
              ) : (
                <button
                  onClick={() => setShowAmendForm(true)}
                  className="w-full rounded-full bg-secondary px-4 py-2.5 text-xs font-bold"
                >
                  Proposer une modification
                </button>
              )}
            </div>

            {/* Mettre fin au bail */}
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-bold">Mettre fin au bail</p>
              {showEndForm ? (
                <EndLeaseForm onSubmit={onEndLease} onCancel={() => setShowEndForm(false)} busy={busy === "end"} />
              ) : (
                <button
                  onClick={() => setShowEndForm(true)}
                  className="w-full rounded-full bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive"
                >
                  Mettre fin au bail
                </button>
              )}
            </div>

            {lease.paymentMode === "avance" ? (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-sm font-bold">Déclarer un versement</p>
                <p className="text-xs text-muted-foreground">
                  Choisissez le mois de départ couvert et le nombre de mois payés d&apos;avance.
                </p>
                <BatchPaymentForm rentAmount={lease.rentAmount} onSubmit={onDeclareBatch} busy={busy === "batch"} />
              </div>
            ) : lease.paymentPeriod === "mensuel" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-bold">Échéances</p>
                  <button
                    onClick={() => setShowBatchForm((v) => !v)}
                    className="text-xs font-bold text-accent underline"
                  >
                    {showBatchForm ? "Fermer" : "Déclarer un versement groupé"}
                  </button>
                </div>
                {showBatchForm && (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <BatchPaymentForm
                      rentAmount={lease.rentAmount}
                      onSubmit={onDeclareBatch}
                      onCancel={() => setShowBatchForm(false)}
                      busy={busy === "batch"}
                    />
                  </div>
                )}
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
          </>
        )}

        {/* Demandes */}
        <div className="space-y-2">
          <p className="px-1 text-sm font-bold">Demandes</p>
          {requests.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">Aucune demande pour l&apos;instant.</p>
          ) : (
            requests.map((r) => (
              <Link
                key={r.id}
                href={`/requests/${r.id}`}
                className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-card"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-bold">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</p>
                </div>
                <RequestStatusBadge status={r.status} />
              </Link>
            ))
          )}
        </div>

        {/* État des lieux */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">État des lieux</p>
          <InspectionLinkRow leaseId={id} type="entree" summary={inspections.find((i) => i.type === "entree")} />
          <InspectionLinkRow leaseId={id} type="sortie" summary={inspections.find((i) => i.type === "sortie")} />
        </div>

        {/* Contrat de bail */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Contrat de bail</p>
          {contractUrl && (
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-accent"
            >
              <Icon name="description" size={16} /> Consulter le contrat
            </a>
          )}
          {!contractUrl && (
            <p className="rounded-xl border border-pending-bg bg-pending-bg/50 px-3 py-2 text-xs font-medium text-pending-text">
              Ajoutez le contrat pour que votre locataire y ait accès.
            </p>
          )}
          <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold">
            <Icon name="upload_file" size={16} filled={false} />
            {uploadingContract ? "Envoi en cours..." : contractUrl ? "Remplacer le contrat" : "Ajouter le contrat"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={onUploadContract}
              disabled={uploadingContract}
              className="hidden"
            />
          </label>
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

function InspectionLinkRow({
  leaseId,
  type,
  summary,
}: {
  leaseId: string;
  type: "entree" | "sortie";
  summary?: InspectionSummary;
}) {
  return (
    <Link
      href={`/my-leases/${leaseId}/inspections/${type}`}
      className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs font-bold"
    >
      {type === "entree" ? "Entrée" : "Sortie"}
      <span className="shrink-0 rounded-md bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
        {summary ? INSPECTION_STATUS_LABELS[summary.status] ?? summary.status : "Pas encore créé"}
      </span>
    </Link>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    nouvelle: { label: "Nouvelle", cls: "bg-pending-bg text-pending-text" },
    en_cours: { label: "En cours", cls: "bg-pending-bg text-pending-text" },
    resolue: { label: "Résolue", cls: "bg-ok-bg text-ok-text" },
    fermee: { label: "Fermée", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? map.nouvelle;
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
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
            {installment.paid.paymentBatchId && " · versement groupé"}
          </p>
        ) : installment.late ? (
          <p className="text-xs font-semibold text-destructive">En retard</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Dû le {new Date(installment.dueDate).toLocaleDateString("fr-FR")}
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

function BatchPaymentForm({
  rentAmount,
  onSubmit,
  onCancel,
  busy,
}: {
  rentAmount: number;
  onSubmit: (startPeriod: string, months: number, paidAt: string) => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  const [startPeriod, setStartPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [months, setMonths] = useState("1");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));

  const monthsNum = Number(months) || 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="batchStart">
            Mois de départ
          </label>
          <input
            id="batchStart"
            type="month"
            value={startPeriod}
            onChange={(e) => setStartPeriod(e.target.value)}
            className={dateInputCls}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="batchMonths">
            Nombre de mois
          </label>
          <input
            id="batchMonths"
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className={dateInputCls}
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="batchPaidAt">
          Date de paiement
        </label>
        <input
          id="batchPaidAt"
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className={dateInputCls}
        />
      </div>
      {monthsNum > 0 && (
        <p className="text-xs text-muted-foreground">
          {monthsNum} mois · <Price amount={rentAmount * monthsNum} size="sm" />
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold"
          >
            Annuler
          </button>
        )}
        <Button
          type="button"
          className="flex-1"
          disabled={busy || !startPeriod || monthsNum < 1}
          onClick={() => onSubmit(`${startPeriod}-01`, monthsNum, paidAt)}
        >
          {busy ? "..." : "Déclarer le versement"}
        </Button>
      </div>
    </div>
  );
}

function EndLeaseForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (status: "termine" | "arrete", reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [status, setStatus] = useState<"termine" | "arrete">("termine");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStatus("termine")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${
            status === "termine" ? "bg-primary text-primary-foreground" : "bg-secondary"
          }`}
        >
          Arrivé à terme
        </button>
        <button
          type="button"
          onClick={() => setStatus("arrete")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-bold ${
            status === "arrete" ? "bg-primary text-primary-foreground" : "bg-secondary"
          }`}
        >
          Arrêté avant terme
        </button>
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Motif (facultatif)"
        className={smallInputCls}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold">
          Annuler
        </button>
        <button
          type="button"
          onClick={() => onSubmit(status, reason)}
          disabled={busy}
          className="flex-1 rounded-full bg-destructive px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? "..." : "Confirmer"}
        </button>
      </div>
    </div>
  );
}

function AmendForm({
  lease,
  onSubmit,
  onCancel,
  busy,
}: {
  lease: MyLease;
  onSubmit: (patch: AmendmentPatch, reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [rentAmount, setRentAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    const patch: AmendmentPatch = {};
    if (rentAmount) patch.rentAmount = Number(rentAmount);
    if (depositAmount) patch.depositAmount = Number(depositAmount);
    if (advanceAmount) patch.advanceAmount = Number(advanceAmount);
    if (paymentDay) patch.paymentDay = Number(paymentDay);
    if (durationMonths) {
      const months = Number(durationMonths);
      patch.durationMonths = months;
      patch.endDate = endDate || addMonths(lease.startDate, months);
    } else if (endDate) {
      patch.endDate = endDate;
    }
    onSubmit(patch, reason);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Laissez un champ vide pour ne pas le changer.</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          value={rentAmount}
          onChange={(e) => setRentAmount(e.target.value)}
          placeholder={`Loyer (${lease.rentAmount})`}
          className={smallInputCls}
        />
        <input
          type="number"
          min={0}
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="Caution"
          className={smallInputCls}
        />
        <input
          type="number"
          min={0}
          value={advanceAmount}
          onChange={(e) => setAdvanceAmount(e.target.value)}
          placeholder="Avance"
          className={smallInputCls}
        />
        <input
          type="number"
          min={1}
          max={31}
          value={paymentDay}
          onChange={(e) => setPaymentDay(e.target.value)}
          placeholder="Jour de paiement"
          className={smallInputCls}
        />
        <input
          type="number"
          min={1}
          value={durationMonths}
          onChange={(e) => setDurationMonths(e.target.value)}
          placeholder="Nouvelle durée (mois)"
          className={smallInputCls}
        />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={smallInputCls} />
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Motif (facultatif)"
        className={smallInputCls}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold">
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "..." : "Proposer"}
        </button>
      </div>
    </div>
  );
}

function AmendmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    acceptee: { label: "Acceptée", cls: "bg-ok-bg text-ok-text" },
    refusee: { label: "Refusée par le locataire", cls: "bg-destructive/10 text-destructive" },
    annulee: { label: "Annulée", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}

function AmendmentDiff({ lease, amendment }: { lease: MyLease; amendment: LeaseAmendment }) {
  const rows: { label: string; oldValue: string; newValue: string }[] = [];
  if (amendment.newRentAmount !== null) {
    rows.push({ label: "Loyer", oldValue: `${lease.rentAmount} FCFA`, newValue: `${amendment.newRentAmount} FCFA` });
  }
  if (amendment.newDepositAmount !== null) {
    rows.push({
      label: "Caution",
      oldValue: `${lease.depositAmount ?? 0} FCFA`,
      newValue: `${amendment.newDepositAmount} FCFA`,
    });
  }
  if (amendment.newAdvanceAmount !== null) {
    rows.push({
      label: "Avance",
      oldValue: `${lease.advanceAmount ?? 0} FCFA`,
      newValue: `${amendment.newAdvanceAmount} FCFA`,
    });
  }
  if (amendment.newPaymentDay !== null) {
    rows.push({
      label: "Jour de paiement",
      oldValue: String(lease.paymentDay ?? "—"),
      newValue: String(amendment.newPaymentDay),
    });
  }
  if (amendment.newDurationMonths !== null || amendment.newEndDate !== null) {
    rows.push({
      label: "Fin du bail",
      oldValue: lease.endDate ? new Date(lease.endDate).toLocaleDateString("fr-FR") : "Indéterminée",
      newValue: amendment.newEndDate ? new Date(amendment.newEndDate).toLocaleDateString("fr-FR") : "—",
    });
  }

  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <p key={r.label} className="text-xs">
          <span className="text-muted-foreground">{r.label} : </span>
          {r.oldValue} → <span className="font-bold">{r.newValue}</span>
        </p>
      ))}
      {amendment.reason && <p className="text-xs text-muted-foreground">Motif : {amendment.reason}</p>}
    </div>
  );
}
