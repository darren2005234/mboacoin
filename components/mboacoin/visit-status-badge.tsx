const VISIT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  demandee: { label: "Demandée", cls: "bg-pending-bg text-pending-text" },
  creneau_propose: { label: "Créneau proposé", cls: "bg-pending-bg text-pending-text" },
  confirmee: { label: "Confirmée", cls: "bg-ok-bg text-ok-text" },
  effectuee: { label: "Effectuée", cls: "bg-seal-bg text-seal-text" },
  annulee: { label: "Annulée", cls: "bg-secondary text-muted-foreground" },
  refusee: { label: "Refusée", cls: "bg-destructive/10 text-destructive" },
  expiree: { label: "Expirée", cls: "bg-secondary text-muted-foreground" },
};

export function VisitStatusBadge({ status }: { status: string }) {
  const s = VISIT_STATUS_MAP[status] ?? VISIT_STATUS_MAP.demandee;
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
