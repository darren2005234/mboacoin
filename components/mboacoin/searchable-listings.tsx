"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ListingCardCompact } from "@/components/mboacoin/listing-card-compact";
import { ListingRow } from "@/components/mboacoin/listing-row";
import { ResidenceRow } from "@/components/mboacoin/residence-row";
import { ResidenceCardCompact, type ResidenceSearchResult } from "@/components/mboacoin/residence-card-compact";
import { Icon } from "@/components/mboacoin/icon";
import type { Listing } from "@/components/mboacoin/listing-card";
import { searchListings, searchResidences } from "@/lib/search";
import { getMyFavoriteIds } from "@/lib/favorites";
import { getVerifiedListings, getListingsByCity, getVerifiedResidences } from "@/lib/home-sections";
import { FiltersSheet, EMPTY_FILTERS, type Filters } from "@/components/mboacoin/filters-sheet";

const SESSION_KEY = "mboacoin-search-filters";
const PAGE_SIZE = 15;

type Sort = "recent" | "price_asc" | "price_desc";

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.minPrice) n++;
  if (f.maxPrice) n++;
  if (f.propertyType) n++;
  if (f.minRooms) n++;
  if (f.minBedrooms) n++;
  if (f.furnishing) n++;
  if (f.carAccess) n++;
  if (f.verifiedOnly) n++;
  return n;
}

export function SearchableListings({ userCity }: { userCity: string | null }) {
  const [keywords, setKeywords] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>("recent");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Résultats (mode recherche OU section "Toutes les annonces" de l'accueil)
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Rangées horizontales de l'accueil
  const [verified, setVerified] = useState<Listing[]>([]);
  const [cityListings, setCityListings] = useState<Listing[]>([]);
  const [residencesHome, setResidencesHome] = useState<ResidenceSearchResult[]>([]);

  // Bascule Logements / Résidences
  const [searchTarget, setSearchTarget] = useState<"logements" | "residences">("logements");
  const [residenceResults, setResidenceResults] = useState<ResidenceSearchResult[]>([]);
  const [residenceTotal, setResidenceTotal] = useState(0);
  const [residenceLoading, setResidenceLoading] = useState(true);
  const [residenceLoadingMore, setResidenceLoadingMore] = useState(false);
  const residenceSentinelRef = useRef<HTMLDivElement | null>(null);
  const residenceLoadingMoreRef = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const activeCount = countActiveFilters(filters);
  const isSearching = keywords.trim() !== "" || activeCount > 0;

  // Favoris
  useEffect(() => {
    (async () => {
      setFavoriteIds(await getMyFavoriteIds());
    })();
  }, []);

  // Rangées horizontales de l'accueil (sélections figées)
  useEffect(() => {
    (async () => {
      const v = await getVerifiedListings(10);
      setVerified(v);
      if (userCity) {
        setCityListings(await getListingsByCity(userCity, 10));
      }
    })();
  }, [userCity]);

  // Rangée d'accueil : résidences dont le gestionnaire est vérifié
  useEffect(() => {
    getVerifiedResidences(10).then(setResidencesHome);
  }, []);

  // Restaurer la session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setKeywords(parsed.keywords ?? "");
        setFilters({ ...EMPTY_FILTERS, ...(parsed.filters ?? {}) });
        setSort(parsed.sort ?? "recent");
        setSearchTarget(parsed.searchTarget === "residences" ? "residences" : "logements");
      }
    } catch {
      // ignore
    }
    restored.current = true;
  }, []);

  // Sauvegarder la session
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ keywords, filters, sort, searchTarget }));
    } catch {
      // ignore
    }
  }, [keywords, filters, sort, searchTarget]);

  const buildCriteria = useCallback(
    (kw: string, f: Filters, s: Sort, offset: number) => ({
      keywords: kw,
      minPrice: f.minPrice ? Number(f.minPrice) : undefined,
      maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
      propertyType: f.propertyType || undefined,
      minRooms: f.minRooms ? Number(f.minRooms) : undefined,
      minBedrooms: f.minBedrooms ? Number(f.minBedrooms) : undefined,
      furnishing: f.furnishing || undefined,
      carAccess: f.carAccess || undefined,
      verifiedOnly: f.verifiedOnly || undefined,
      sort: s,
      offset,
      limit: PAGE_SIZE,
    }),
    []
  );

  const runSearch = useCallback(
    async (kw: string, f: Filters, s: Sort) => {
      setLoading(true);
      const result = await searchListings(buildCriteria(kw, f, s, 0));
      setListings(result.listings);
      setTotal(result.total);
      setLoading(false);
    },
    [buildCriteria]
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (listings.length >= total) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const result = await searchListings(buildCriteria(keywords, filters, sort, listings.length));
    setListings((prev) => [...prev, ...result.listings]);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [buildCriteria, keywords, filters, sort, listings.length, total]);

  const runResidenceSearch = useCallback(async (kw: string) => {
    setResidenceLoading(true);
    const result = await searchResidences({ keywords: kw, offset: 0, limit: PAGE_SIZE });
    setResidenceResults(result.residences);
    setResidenceTotal(result.total);
    setResidenceLoading(false);
  }, []);

  const loadMoreResidences = useCallback(async () => {
    if (residenceLoadingMoreRef.current) return;
    if (residenceResults.length >= residenceTotal) return;
    residenceLoadingMoreRef.current = true;
    setResidenceLoadingMore(true);
    const result = await searchResidences({ keywords, offset: residenceResults.length, limit: PAGE_SIZE });
    setResidenceResults((prev) => [...prev, ...result.residences]);
    setResidenceLoadingMore(false);
    residenceLoadingMoreRef.current = false;
  }, [keywords, residenceResults.length, residenceTotal]);

  // Charger/recharger la liste : que ce soit en recherche OU en accueil (Toutes les annonces),
  // on utilise searchListings. La différence est juste les critères (kw/filtres ou vides).
  useEffect(() => {
    if (!restored.current) return;
    runSearch(keywords, filters, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, restored.current]);

  // Relancer la recherche quand les mots-clés (ou la cible logements/résidences) changent
  useEffect(() => {
    if (!restored.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchTarget === "residences") runResidenceSearch(keywords);
      else runSearch(keywords, filters, sort);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords, searchTarget]);

  function onKeywordsChange(value: string) {
    setKeywords(value);
  }

  // Défilement infini (vaut pour la recherche ET "Toutes les annonces")
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loading]);

  // Défilement infini pour la liste des résidences
  useEffect(() => {
    const sentinel = residenceSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !residenceLoading) loadMoreResidences();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreResidences, residenceLoading]);

  // Bloc de grille (résultats), réutilisé dans les deux modes
  const grid = (
    <>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-bold">Aucune annonce trouvée</p>
          <p className="text-sm text-muted-foreground">Essayez d&apos;élargir votre recherche.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {listings.map((l) => (
              <ListingCardCompact
                key={`${l.id}-${favoriteIds.has(l.id)}`}
                listing={l}
                initialFavorited={favoriteIds.has(l.id)}
              />
            ))}
          </div>
          {listings.length < total && (
            <div ref={sentinelRef} className="py-4 text-center">
              {loadingMore ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <p className="text-xs text-muted-foreground">Faites défiler pour voir plus</p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  // En-tête de la liste (compteur + tri), réutilisé
  const listHeader = (title: string) => (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-bold">
        {loading ? "..." : isSearching ? `${total} annonce${total > 1 ? "s" : ""}` : title}
      </p>
      <div className="flex items-center gap-2">
        {isSearching && (
          <button
            onClick={() => {
              setKeywords("");
              setFilters(EMPTY_FILTERS);
            }}
            className="text-sm font-semibold text-primary"
          >
            Effacer
          </button>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold outline-none focus:border-accent"
        >
          <option value="recent">Plus récentes</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* Barre de recherche */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
          <Search className="size-5 text-muted-foreground" strokeWidth={2.25} />
          <input
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder={
              searchTarget === "residences" ? "Nom de résidence, ville, quartier..." : "Ville, quartier, mot-clé..."
            }
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {searchTarget === "logements" && (
            <button aria-label="Filtres" onClick={() => setSheetOpen(true)} className="relative text-primary">
              <SlidersHorizontal className="size-5" strokeWidth={2.25} />
              {activeCount > 0 && (
                <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bascule Logements / Résidences */}
      <div className="flex gap-2 px-5 pb-4">
        <button
          type="button"
          onClick={() => setSearchTarget("logements")}
          className={
            searchTarget === "logements"
              ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
          }
        >
          Logements
        </button>
        <button
          type="button"
          onClick={() => setSearchTarget("residences")}
          className={
            searchTarget === "residences"
              ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
          }
        >
          Résidences
        </button>
      </div>

      {searchTarget === "residences" ? (
        /* ===== MODE RÉSIDENCES ===== */
        <div className="space-y-4 px-5 pb-8">
          <p className="text-sm font-bold">
            {residenceLoading ? "..." : `${residenceTotal} résidence${residenceTotal > 1 ? "s" : ""}`}
          </p>
          {residenceLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
          ) : residenceResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-bold">Aucune résidence trouvée</p>
              <p className="text-sm text-muted-foreground">Essayez d&apos;élargir votre recherche.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {residenceResults.map((r) => (
                  <ResidenceCardCompact key={r.id} residence={r} />
                ))}
              </div>
              {residenceResults.length < residenceTotal && (
                <div ref={residenceSentinelRef} className="py-4 text-center">
                  {residenceLoadingMore ? (
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Faites défiler pour voir plus</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : isSearching ? (
        /* ===== MODE RECHERCHE ===== */
        <div className="space-y-4 px-5 pb-8">
          {listHeader("")}
          {grid}
        </div>
      ) : (
        /* ===== MODE ACCUEIL ===== */
        <div className="space-y-6 pb-8">
          <ListingRow
            title="Logements vérifiés pour vous"
            listings={verified}
            favoriteIds={favoriteIds}
            icon={<Icon name="verified" size={18} className="text-seal-text" />}
            onSeeAll={() => {
              setFilters({ ...EMPTY_FILTERS, verifiedOnly: true });
            }}
          />

          {userCity && (
            <ListingRow
              title="Tout près de chez vous"
              listings={cityListings}
              favoriteIds={favoriteIds}
              icon={<Icon name="location_on" size={18} className="text-accent" />}
              onSeeAll={() => {
                setKeywords(userCity);
              }}
            />
          )}

          <ResidenceRow
            title="Nos résidences"
            residences={residencesHome}
            icon={<Icon name="location_city" size={18} className="text-accent" />}
            onSeeAll={() => {
              setSearchTarget("residences");
              setKeywords("");
            }}
          />

          {/* Toutes les annonces : catalogue triable + défilement infini */}
          <section className="space-y-3 px-5">
            {listHeader("Toutes les annonces")}
            {grid}
          </section>
        </div>
      )}

      <FiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={filters}
        keywords={keywords}
        onApply={(f) => setFilters(f)}
      />
    </div>
  );
}