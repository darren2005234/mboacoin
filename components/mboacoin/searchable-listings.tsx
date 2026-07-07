"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ListingCard, type Listing } from "@/components/mboacoin/listing-card";
import { searchListings } from "@/lib/search";
import { getMyFavoriteIds } from "@/lib/favorites";
import { FiltersSheet, EMPTY_FILTERS, type Filters } from "@/components/mboacoin/filters-sheet";

// Conserve les filtres pendant la session (mémoire du navigateur)
const SESSION_KEY = "mboacoin-search-filters";

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.minPrice) n++;
  if (f.maxPrice) n++;
  if (f.propertyType) n++;
  if (f.minRooms) n++;
  if (f.minBedrooms) n++;
  if (f.furnishing) n++;
  if (f.carAccess) n++;
  return n;
}

export function SearchableListings() {
  const [keywords, setKeywords] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);

  // Charger les favoris une fois
  useEffect(() => {
    (async () => {
      setFavoriteIds(await getMyFavoriteIds());
    })();
  }, []);

  // Restaurer les filtres de la session au chargement
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setKeywords(parsed.keywords ?? "");
        setFilters(parsed.filters ?? EMPTY_FILTERS);
      }
    } catch {
      // ignore
    }
    restored.current = true;
  }, []);

  // Sauvegarder les filtres dans la session
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ keywords, filters }));
    } catch {
      // ignore
    }
  }, [keywords, filters]);

  const runSearch = useCallback(async (kw: string, f: Filters) => {
    setLoading(true);
    const result = await searchListings({
      keywords: kw,
      minPrice: f.minPrice ? Number(f.minPrice) : undefined,
      maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
      propertyType: f.propertyType || undefined,
      minRooms: f.minRooms ? Number(f.minRooms) : undefined,
      minBedrooms: f.minBedrooms ? Number(f.minBedrooms) : undefined,
      furnishing: f.furnishing || undefined,
      carAccess: f.carAccess || undefined,
    });
    setListings(result.listings);
    setTotal(result.total);
    setLoading(false);
  }, []);

  // Recherche initiale + à chaque changement de filtres
  useEffect(() => {
    if (!restored.current) return;
    runSearch(keywords, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, restored.current]);

  // Recherche avec pause quand on tape des mots-clés
  function onKeywordsChange(value: string) {
    setKeywords(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(value, filters);
    }, 300);
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col">
      {/* Barre de recherche */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
          <Search className="size-5 text-muted-foreground" strokeWidth={2.25} />
          <input
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder="Ville, quartier, mot-clé..."
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <button
            aria-label="Filtres"
            onClick={() => setSheetOpen(true)}
            className="relative text-primary"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2.25} />
            {activeCount > 0 && (
              <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Compteur + liste */}
      <div className="space-y-4 px-5 pb-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">
            {loading ? "Recherche..." : `${total} annonce${total > 1 ? "s" : ""}`}
          </p>
          {activeCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm font-semibold text-primary"
            >
              Effacer les filtres
            </button>
          )}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-bold">Aucune annonce trouvée</p>
            <p className="text-sm text-muted-foreground">Essayez d&apos;élargir votre recherche ou vos filtres.</p>
          </div>
        ) : (
          listings.map((l) => (
            <ListingCard key={l.id} listing={l} initialFavorited={favoriteIds.has(l.id)} />
          ))
        )}
      </div>

      {/* Panneau de filtres */}
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