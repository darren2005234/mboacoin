"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { AdminSectionCard } from "@/components/mboacoin/admin-section-card";
import { getPendingVerificationsCount } from "@/lib/admin-verification";
import { getPendingListingVerifsCount } from "@/lib/admin-listing-verification";
import { getPendingReportsCount } from "@/lib/admin-reports";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [verificationsCount, setVerificationsCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [identity, listing, reports] = await Promise.all([
        getPendingVerificationsCount(),
        getPendingListingVerifsCount(),
        getPendingReportsCount(),
      ]);
      setVerificationsCount(identity + listing);
      setReportsCount(reports);
      setLoading(false);
    })();
  }, []);

  const sections = [
    {
      icon: "verified_user",
      label: "Vérifications",
      description: "Identité, entité et logement",
      href: "/admin/verifications",
      count: verificationsCount,
    },
    {
      icon: "flag",
      label: "Signalements",
      description: "Annonces et utilisateurs signalés",
      href: "/admin/reports",
      count: reportsCount,
    },
    {
      icon: "query_stats",
      label: "Analytique",
      description: "Recherches, vues, favoris",
      href: "/admin/analytics",
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ScreenHeader title="Administration" />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-3 px-5">
          {sections.map((s) => (
            <AdminSectionCard key={s.href} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}
