"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { getMyListingsPerformance, type ListingPerformance } from "@/lib/pro-performance";

type SortKey = "viewCount" | "favoriteCount" | "conversationCount";

const SORT_LABELS: Record<SortKey, string> = {
  viewCount: "Vues",
  favoriteCount: "Favoris",
  conversationCount: "Contacts",
};

function ListingRow({ listing }: { listing: ListingPerformance }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="line-clamp-1 text-sm font-bold">{listing.title}</p>
      <p className="text-xs text-muted-foreground">{listing.location}</p>
      <div className="mt-2 flex gap-4 text-xs font-semibold text-foreground/80">
        <span className="flex items-center gap-1">
          <Icon name="visibility" size={14} className="text-accent" /> {listing.viewCount}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="favorite" size={14} className="text-fav" /> {listing.favoriteCount}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="chat_bubble" size={14} className="text-accent" /> {listing.conversationCount}
        </span>
      </div>
    </div>
  );
}

export function PerformanceDashboard({ accountType }: { accountType: string }) {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingPerformance[]>([]);
  const [totals, setTotals] = useState({ views: 0, favorites: 0, conversations: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("viewCount");

  useEffect(() => {
    (async () => {
      const result = await getMyListingsPerformance();
      setListings(result.listings);
      setTotals(result.totals);
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(
    () => [...listings].sort((a, b) => b[sortKey] - a[sortKey]),
    [listings, sortKey]
  );

  const groupedByResidence = useMemo(() => {
    if (accountType !== "residence") return null;
    const groups = new Map<string, { name: string; listings: ListingPerformance[] }>();
    for (const l of listings) {
      const key = l.residenceId ?? "__none__";
      const name = l.residenceName ?? "Logements sans résidence";
      const existing = groups.get(key);
      if (existing) existing.listings.push(l);
      else groups.set(key, { name, listings: [l] });
    }
    return [...groups.values()];
  }, [listings, accountType]);

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <ScreenHeader title="Statistiques" subtitle="Performances de vos annonces." />

      {/* Résumé global */}
      <section className="px-5">
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-card">
          <div>
            <p className="font-mono text-lg font-bold">{totals.views}</p>
            <p className="text-xs text-muted-foreground">Vues</p>
          </div>
          <div className="border-l border-border">
            <p className="font-mono text-lg font-bold">{totals.favorites}</p>
            <p className="text-xs text-muted-foreground">Favoris</p>
          </div>
          <div className="border-l border-border">
            <p className="font-mono text-lg font-bold">{totals.conversations}</p>
            <p className="text-xs text-muted-foreground">Conversations</p>
          </div>
        </div>
      </section>

      {accountType === "agence" && (
        <section className="px-5">
          <Link
            href="/analytics/market"
            className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-accent">
              <Icon name="query_stats" size={20} /> Donnée de marché
            </span>
            <Icon name="chevron_right" size={20} className="text-accent" />
          </Link>
        </section>
      )}

      {listings.length === 0 ? (
        <section className="px-5">
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune annonce pour le moment.</p>
        </section>
      ) : (
        <>
          {groupedByResidence && (
            <section className="space-y-3 px-5">
              <h2 className="text-base font-extrabold leading-tight">Par résidence</h2>
              <div className="space-y-2">
                {groupedByResidence.map((g) => {
                  const totalViews = g.listings.reduce((s, l) => s + l.viewCount, 0);
                  const totalFavs = g.listings.reduce((s, l) => s + l.favoriteCount, 0);
                  const totalConvs = g.listings.reduce((s, l) => s + l.conversationCount, 0);
                  return (
                    <div key={g.name} className="rounded-xl border border-border bg-secondary/50 p-3">
                      <p className="text-sm font-bold">{g.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.listings.length} logement{g.listings.length > 1 ? "s" : ""} · {totalViews} vues ·{" "}
                        {totalFavs} favoris · {totalConvs} contacts
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3 px-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold leading-tight">Par annonce</h2>
              <div className="flex gap-1.5">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key)}
                    className={
                      sortKey === key
                        ? "rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                        : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sorted.map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
