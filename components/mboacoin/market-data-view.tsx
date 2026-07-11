"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { SampleNote } from "@/components/mboacoin/sample-note";
import type { RecentSearchEvent, TopSearchTerm } from "@/lib/admin-analytics";
import type { BudgetBucket } from "@/lib/budget-buckets";
import {
  getDemandByZone,
  getMarketBudgetDistribution,
  getMarketZeroResultSearches,
  getAveragePricesByZone,
  getSearchTrend,
  type MarketZone,
  type PriceGroup,
  type MonthlyTrendPoint,
} from "@/lib/market-data";

function summarizeFilters(s: RecentSearchEvent): string {
  const parts: string[] = [];
  if (s.propertyType) parts.push(s.propertyType);
  if (s.minPrice || s.maxPrice) parts.push(`${s.minPrice ?? "?"}–${s.maxPrice ?? "?"} FCFA`);
  if (s.minRooms) parts.push(`≥ ${s.minRooms} pièce(s)`);
  if (s.minBedrooms) parts.push(`≥ ${s.minBedrooms} chambre(s)`);
  if (s.furnishing) parts.push(s.furnishing);
  if (s.carAccess) parts.push("Accès voiture");
  if (s.verifiedOnly) parts.push("Vérifiés uniquement");
  return parts.length > 0 ? parts.join(" · ") : "Aucun filtre";
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function MarketDataView() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<{ terms: TopSearchTerm[]; sampleSize: number }>({ terms: [], sampleSize: 0 });
  const [budget, setBudget] = useState<{ buckets: BudgetBucket[]; sampleSize: number }>({ buckets: [], sampleSize: 0 });
  const [zeroResult, setZeroResult] = useState<RecentSearchEvent[]>([]);
  const [prices, setPrices] = useState<{ groups: PriceGroup[]; sampleSize: number }>({ groups: [], sampleSize: 0 });
  const [trend, setTrend] = useState<{ points: MonthlyTrendPoint[]; hasEnoughHistory: boolean }>({
    points: [],
    hasEnoughHistory: false,
  });

  useEffect(() => {
    const zone: MarketZone = city.trim() ? { city: city.trim() } : {};
    setLoading(true);
    (async () => {
      const [t, b, z, p, tr] = await Promise.all([
        getDemandByZone(zone),
        getMarketBudgetDistribution(zone),
        getMarketZeroResultSearches(zone),
        getAveragePricesByZone(zone),
        getSearchTrend(zone),
      ]);
      setTerms(t);
      setBudget(b);
      setZeroResult(z);
      setPrices(p);
      setTrend(tr);
      setLoading(false);
    })();
  }, [city]);

  const maxTermCount = Math.max(1, ...terms.terms.map((t) => t.count));
  const maxBucketCount = Math.max(1, ...budget.buckets.map((b) => b.count));
  const maxTrendCount = Math.max(1, ...trend.points.map((p) => p.searchCount));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <Link href="/analytics" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Donnée de marché" subtitle="Demande, budgets et prix, construits sur les recherches des locataires." />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
          <Search className="size-5 text-muted-foreground" strokeWidth={2.25} />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filtrer par ville ou quartier..."
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <>
          {/* Recherches sans résultat — la donnée la plus précieuse */}
          <section className="space-y-3 px-5">
            <div className="flex items-center gap-2">
              <Icon name="search_off" size={18} className="text-destructive" />
              <h2 className="text-base font-extrabold leading-tight">Recherches sans résultat</h2>
            </div>
            <SampleNote size={zeroResult.length} />
            {zeroResult.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recherche sans résultat sur cette zone.</p>
            ) : (
              <div className="space-y-2">
                {zeroResult.map((e) => (
                  <div key={e.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-bold">{e.keywords ? `« ${e.keywords} »` : "(sans mot-clé)"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{summarizeFilters(e)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Demande par zone */}
          <section className="space-y-3 px-5">
            <h2 className="text-base font-extrabold leading-tight">Demande par zone</h2>
            <SampleNote size={terms.sampleSize} />
            {terms.terms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore de données.</p>
            ) : (
              <div className="space-y-1.5">
                {terms.terms.map((t) => (
                  <Bar key={t.term} label={t.term} count={t.count} max={maxTermCount} />
                ))}
              </div>
            )}
          </section>

          {/* Budgets recherchés */}
          <section className="space-y-3 px-5">
            <h2 className="text-base font-extrabold leading-tight">Budgets recherchés</h2>
            <SampleNote size={budget.sampleSize} />
            {budget.sampleSize === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore de données.</p>
            ) : (
              <div className="space-y-1.5">
                {budget.buckets.map((b) => (
                  <Bar key={b.label} label={b.label} count={b.count} max={maxBucketCount} />
                ))}
              </div>
            )}
          </section>

          {/* Prix moyens du marché */}
          <section className="space-y-3 px-5">
            <h2 className="text-base font-extrabold leading-tight">Prix moyens du marché</h2>
            <SampleNote size={prices.sampleSize} unit="annonce" />
            {prices.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore de données.</p>
            ) : (
              <div className="space-y-2">
                {prices.groups.map((g) => (
                  <div key={`${g.city}-${g.propertyType}`} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                    <div>
                      <p className="text-sm font-bold">{g.propertyType}</p>
                      <p className="text-xs text-muted-foreground">{g.city} · {g.count} annonce{g.count > 1 ? "s" : ""}</p>
                    </div>
                    <p className="font-mono text-sm font-bold">{g.avgPrice.toLocaleString("fr-FR")} FCFA</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Évolution dans le temps */}
          <section className="space-y-3 px-5">
            <h2 className="text-base font-extrabold leading-tight">Évolution dans le temps</h2>
            {!trend.hasEnoughHistory ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Historique en constitution, les tendances apparaîtront au fil des semaines.
              </p>
            ) : (
              <div className="space-y-1.5">
                {trend.points.map((p) => (
                  <Bar key={p.month} label={p.month} count={p.searchCount} max={maxTrendCount} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
