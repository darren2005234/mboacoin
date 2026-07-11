"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { AdminSectionCard } from "@/components/mboacoin/admin-section-card";
import { getPendingVerificationsCount } from "@/lib/admin-verification";
import { getPendingListingVerifsCount } from "@/lib/admin-listing-verification";

export default function AdminVerificationsMenuPage() {
  const [loading, setLoading] = useState(true);
  const [identityCount, setIdentityCount] = useState(0);
  const [listingCount, setListingCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [identity, listing] = await Promise.all([
        getPendingVerificationsCount(),
        getPendingListingVerifsCount(),
      ]);
      setIdentityCount(identity);
      setListingCount(listing);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Vérifications" subtitle="Identité, entité et logement." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-3 px-5">
          <AdminSectionCard
            icon="badge"
            label="Vérifications d'identité"
            description="Particuliers, agences et résidences"
            href="/admin/verifications/identity"
            count={identityCount}
          />
          <AdminSectionCard
            icon="video_library"
            label="Vérifications de logement"
            description="Vidéos de logements en attente"
            href="/admin/verifications/listing"
            count={listingCount}
          />
        </div>
      )}
    </div>
  );
}
