import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/mboacoin/price";
import { priceSuffixFor } from "@/lib/price-period";
import { daysUntil, COVERAGE_ENDING_SOON_DAYS } from "@/lib/lease-schedule";
import type { MyLease } from "@/lib/leases";
import type { LeaseScheduleStatus } from "@/lib/lease-payments";
import { currentRenewalIntent, type LeaseRenewalIntent } from "@/lib/lease-renewal-intent";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  en_attente_confirmation: { label: "En attente", cls: "bg-pending-bg text-pending-text" },
  actif: { label: "Actif", cls: "bg-ok-bg text-ok-text" },
  rejete: { label: "Rejeté", cls: "bg-destructive/10 text-destructive" },
  termine: { label: "Terminé", cls: "bg-secondary text-muted-foreground" },
  resilie: { label: "Résilié", cls: "bg-secondary text-muted-foreground" },
  arrete: { label: "Arrêté", cls: "bg-secondary text-muted-foreground" },
  annule: { label: "Annulé", cls: "bg-secondary text-muted-foreground" },
};

export function LeaseStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.en_attente_confirmation;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}

/**
 * Ligne d'un bail dans une liste (espace bailleur/gestionnaire) : logement,
 * locataire, statut, échéance/couverture. Partagée par la liste plate
 * (comptes particulier/agence) et la vue par résidence (comptes résidence)
 * pour que l'affichage ne diverge jamais entre les deux — même seuil
 * "bientôt échue" (COVERAGE_ENDING_SOON_DAYS) et même calcul de retard
 * (scheduleStatus, dérivé de lib/lease-schedule.ts) partout.
 */
export function LeaseListItem({
  lease: l,
  scheduleStatus,
  renewalIntent,
}: {
  lease: MyLease;
  scheduleStatus?: LeaseScheduleStatus;
  renewalIntent?: LeaseRenewalIntent;
}) {
  const dueDate = l.status === "actif" ? (scheduleStatus?.nextDueDate ?? null) : null;
  const remaining = l.status === "actif" && l.endDate ? daysUntil(l.endDate) : null;
  const intent =
    l.status === "actif" && l.paymentMode === "avance" && remaining !== null && remaining <= COVERAGE_ENDING_SOON_DAYS
      ? currentRenewalIntent(l.endDate, renewalIntent)
      : null;

  return (
    <Link href={`/my-leases/${l.id}`} className="block rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
          <Image src={l.listingImage} alt="" fill className="object-cover" sizes="64px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-bold">{l.listingTitle}</p>
          <p className="text-xs text-muted-foreground">
            {l.tenantName ?? "Locataire non rattaché"} · {l.tenantPhone}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Price amount={l.rentAmount} suffix={priceSuffixFor(l.paymentPeriod)} size="sm" />
            <LeaseStatusBadge status={l.status} />
            {l.status === "actif" && l.paymentMode !== "avance" && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  scheduleStatus?.late ? "bg-destructive/10 text-destructive" : "bg-ok-bg text-ok-text"
                }`}
              >
                {scheduleStatus?.late ? "En retard" : "À jour"}
              </span>
            )}
            {remaining !== null && remaining <= COVERAGE_ENDING_SOON_DAYS && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  remaining < 0 ? "bg-destructive/10 text-destructive" : "bg-pending-bg text-pending-text"
                }`}
              >
                {l.paymentMode === "avance"
                  ? remaining < 0
                    ? "Échue"
                    : "Bientôt échue"
                  : remaining < 0
                    ? "Échéance dépassée"
                    : "Échéance proche"}
              </span>
            )}
            {intent && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  intent === "reste" ? "bg-ok-bg text-ok-text" : "bg-pending-bg text-pending-text"
                }`}
              >
                {intent === "reste" ? "Locataire : reste" : "Locataire : part"}
              </span>
            )}
          </div>
          {l.status === "actif" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {l.paymentMode === "avance"
                ? l.endDate
                  ? `Couvert jusqu'au ${new Date(l.endDate).toLocaleDateString("fr-FR")}`
                  : "Aucune période payée pour l'instant"
                : dueDate
                  ? `Prochain loyer dû le ${new Date(dueDate).toLocaleDateString("fr-FR")}`
                  : "Facturation quotidienne"}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>Début : {new Date(l.startDate).toLocaleDateString("fr-FR")}</span>
        <span>{l.durationMonths ? `${l.durationMonths} mois` : "Durée indéterminée"}</span>
      </div>
    </Link>
  );
}
