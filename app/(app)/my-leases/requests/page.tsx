"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { getMyLandlordRequests, REQUEST_TYPE_LABELS, type LandlordLeaseRequestSummary } from "@/lib/lease-requests";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function LandlordLeaseRequestsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [requests, setRequests] = useState<LandlordLeaseRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getMyLandlordRequests().then((data) => {
      setRequests(data);
      setLoading(false);
    });
  }, [ready]);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Toutes les demandes" subtitle="Toutes vos locations confondues." />

      {!ready || loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : requests.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Aucune demande pour l&apos;instant
        </p>
      ) : (
        <div className="space-y-3 px-5 pb-8">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/requests/${r.id}`)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-sm font-bold">{r.subject}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.listingTitle} · {r.tenantName ?? "Locataire"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    nouvelle: { label: "Nouvelle", cls: "bg-pending-bg text-pending-text" },
    en_cours: { label: "En cours", cls: "bg-pending-bg text-pending-text" },
    resolue: { label: "Résolue", cls: "bg-ok-bg text-ok-text" },
    fermee: { label: "Fermée", cls: "bg-secondary text-muted-foreground" },
  };
  const s = map[status] ?? map.nouvelle;
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}
