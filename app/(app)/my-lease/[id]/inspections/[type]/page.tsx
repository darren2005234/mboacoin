"use client";

import { use, useEffect, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { InspectionView } from "@/components/mboacoin/inspection-view";
import { createClient } from "@/lib/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";

interface TenantLeaseInfo {
  listingTitle: string;
  landlordName: string | null;
}

/** Contrairement à my-lease/[id]/page.tsx, accessible quel que soit le statut du bail
 * (l'état des lieux de sortie doit rester consultable après la fin du bail). */
async function getTenantLeaseInfo(leaseId: string): Promise<TenantLeaseInfo | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("leases")
    .select("id, listing:listings(title), landlord:profiles!landlord_id(full_name)")
    .eq("id", leaseId)
    .eq("tenant_id", user.id)
    .maybeSingle();

  if (!data) return null;
  const listing = Array.isArray(data.listing) ? data.listing[0] : data.listing;
  const landlord = Array.isArray(data.landlord) ? data.landlord[0] : data.landlord;
  return {
    listingTitle: listing?.title ?? "Logement",
    landlordName: landlord?.full_name ?? null,
  };
}

export default function TenantInspectionPage({ params }: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = use(params);
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [lease, setLease] = useState<TenantLeaseInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    getTenantLeaseInfo(id).then((l) => {
      if (!l) {
        router.push("/my-lease");
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
      <ScreenHeader title={lease.listingTitle} subtitle={lease.landlordName ?? undefined} />
      <InspectionView leaseId={id} type={type} role="locataire" />
    </div>
  );
}
