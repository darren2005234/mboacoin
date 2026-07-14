"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { InspectionView } from "@/components/mboacoin/inspection-view";
import { getMyLeaseById, type MyLease } from "@/lib/leases";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function LandlordInspectionPage({ params }: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [lease, setLease] = useState<MyLease | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    getMyLeaseById(id).then((l) => {
      if (!l) {
        router.push("/my-leases");
        return;
      }
      setLease(l);
    });
  }, [id, ready, router]);

  if (type !== "entree" && type !== "sortie") notFound();

  if (!ready || lease === undefined) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }
  if (!lease) return null;

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title={lease.listingTitle} subtitle={lease.tenantName ?? lease.tenantPhone} />
      <InspectionView leaseId={id} type={type} role="bailleur" />
    </div>
  );
}
