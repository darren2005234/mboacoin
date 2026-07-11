"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { SampleNote } from "@/components/mboacoin/sample-note";
import {
  getRecentSearches,
  getZeroResultSearches,
  getTopSearchTerms,
  getBudgetDistribution,
  getMostViewedListings,
  getMostFavoritedListings,
  type RecentSearchEvent,
  type TopSearchTermsResult,
  type BudgetDistributionResult,
  type ListingStat,
} from "@/lib/admin-analytics";

function summarizeFilters(s: RecentSearchEvent): string {
  const parts: string[] = [];
  if (s.propertyType) parts.push(s.propertyType);
  if (s.minPrice || s.maxPrice) {
    parts.push(`${s.minPrice ?? "?"}–${s.maxPrice ?? "?"} FCFA`);
  }
  if (s.minRooms) parts.push(`≥ ${s.minRooms} pièce(s)`);
  if (s.minBedrooms) parts.push(`≥ ${s.minBedrooms} chambre(s)`);
  if (s.furnishing) parts.push(s.furnishing);
  if (s.carAccess) parts.push("Accès voiture");
  if (s.verifiedOnly) parts.push("Vérifiés uniquement");
  return parts.length > 0 ? parts.join(" · ") : "Aucun filtre";
}

function SearchEventRow({ event }: { event: RecentSearchEvent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{event.keywords ? `« ${event.keywords} »` : "(sans mot-clé)"}</p>
        <span className="text-xs font-semibold text-muted-foreground">
          {new Date(event.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{summarizeFilters(event)}</p>
      <p
        className={
          event.resultsCount === 0
            ? "mt-1 text-xs font-bold text-destructive"
            : "mt-1 text-xs font-semibold text-accent"
        }
      >
        {event.resultsCount} résultat{event.resultsCount > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<RecentSearchEvent[]>([]);
  const [zeroResult, setZeroResult] = useState<RecentSearchEvent[]>([]);
  const [topTerms, setTopTerms] = useState<TopSearchTermsResult>({ terms: [], sampleSize: 0 });
  const [budget, setBudget] = useState<BudgetDistributionResult>({ buckets: [], sampleSize: 0 });
  const [mostViewed, setMostViewed] = useState<ListingStat[]>([]);
  const [mostFavorited, setMostFavorited] = useState<ListingStat[]>([]);

  useEffect(() => {
    (async () => {
      const [r, z, t, b, v, f] = await Promise.all([
        getRecentSearches(50),
        getZeroResultSearches(50),
        getTopSearchTerms(10),
        getBudgetDistribution(),
        getMostViewedListings(10),
        getMostFavoritedListings(10),
      ]);
      setRecent(r);
      setZeroResult(z);
      setTopTerms(t);
      setBudget(b);
      setMostViewed(v);
      setMostFavorited(f);
      setLoading(false);
    })();
  }, []);

  const maxTermCount = Math.max(1, ...topTerms.terms.map((t) => t.count));
  const maxBucketCount = Math.max(1, ...budget.buckets.map((b) => b.count));
  const maxViewCount = Math.max(1, ...mostViewed.map((l) => l.count));
  const maxFavCount = Math.max(1, ...mostFavorited.map((l) => l.count));

  if (loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <Link href="/profile" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Observatoire" subtitle="Recherches, budgets et annonces les plus consultées." />

      {/* Recherches sans résultat — la donnée la plus précieuse */}
      <section className="space-y-3 px-5">
        <div className="flex items-center gap-2">
          <Icon name="search_off" size={18} className="text-destructive" />
          <h2 className="text-base font-extrabold leading-tight">Recherches sans résultat</h2>
        </div>
        <SampleNote size={zeroResult.length} />
        {zeroResult.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune recherche sans résultat enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {zeroResult.map((e) => (
              <SearchEventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      {/* Top termes recherchés */}
      <section className="space-y-3 px-5">
        <h2 className="text-base font-extrabold leading-tight">Termes les plus recherchés</h2>
        <SampleNote size={topTerms.sampleSize} />
        {topTerms.terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de données.</p>
        ) : (
          <div className="space-y-1.5">
            {topTerms.terms.map((t) => (
              <div key={t.term} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{t.term}</span>
                  <span className="text-muted-foreground">{t.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(t.count / maxTermCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Répartition des budgets */}
      <section className="space-y-3 px-5">
        <h2 className="text-base font-extrabold leading-tight">Répartition des budgets recherchés</h2>
        <SampleNote size={budget.sampleSize} />
        {budget.sampleSize === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de données.</p>
        ) : (
          <div className="space-y-1.5">
            {budget.buckets.map((b) => (
              <div key={b.label} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{b.label}</span>
                  <span className="text-muted-foreground">{b.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(b.count / maxBucketCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Annonces les plus vues / les plus favorites */}
      <section className="space-y-3 px-5">
        <h2 className="text-base font-extrabold leading-tight">Annonces les plus vues</h2>
        {mostViewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de données.</p>
        ) : (
          <div className="space-y-1.5">
            {mostViewed.map((l) => (
              <div key={l.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="line-clamp-1">{l.title}</span>
                  <span className="shrink-0 text-muted-foreground">{l.count} vue{l.count > 1 ? "s" : ""}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(l.count / maxViewCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 px-5">
        <h2 className="text-base font-extrabold leading-tight">Annonces les plus mises en favori</h2>
        {mostFavorited.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pas encore de données.</p>
        ) : (
          <div className="space-y-1.5">
            {mostFavorited.map((l) => (
              <div key={l.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="line-clamp-1">{l.title}</span>
                  <span className="shrink-0 text-muted-foreground">{l.count} favori{l.count > 1 ? "s" : ""}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-fav"
                    style={{ width: `${(l.count / maxFavCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recherches récentes (brut, pour vérifier que la collecte fonctionne) */}
      <section className="space-y-3 px-5">
        <h2 className="text-base font-extrabold leading-tight">Recherches récentes</h2>
        <SampleNote size={recent.length} />
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune recherche enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((e) => (
              <SearchEventRow key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
