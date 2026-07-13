"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { ListingCard, type Listing } from "@/components/mboacoin/listing-card";
import { getMyFavorites, getMyFavoriteIds } from "@/lib/favorites";
import { getMyViewedListings, clearMyViewHistory } from "@/lib/listing-views";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/lib/use-require-auth";

type Tab = "favoris" | "historique";

export default function FavoritesPage() {
  const { ready } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("favoris");
  const [favorites, setFavorites] = useState<(Listing & { available: boolean })[]>([]);
  const [history, setHistory] = useState<(Listing & { available: boolean })[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favSort, setFavSort] = useState<"recent" | "price_asc" | "price_desc">("recent");

  useEffect(() => {
    if (!ready) return;
    (async () => {
      setFavoriteIds(await getMyFavoriteIds());
    })();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      setFavorites(await getMyFavorites(favSort));
    })();
  }, [favSort, ready]);

  // Charger l'historique la première fois qu'on ouvre l'onglet
  useEffect(() => {
    if (tab === "historique" && !historyLoaded && ready) {
      (async () => {
        setHistory(await getMyViewedListings());
        setHistoryLoaded(true);
      })();
    }
  }, [tab, historyLoaded, ready]);

  async function clearHistory() {
    if (!confirm("Effacer tout votre historique de consultation ?")) return;
    await clearMyViewHistory();
    setHistory([]);
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mes annonces suivies" />

      {/* Onglets */}
      <div className="flex gap-2 px-5 pb-4">
        <button
          onClick={() => setTab("favoris")}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "favoris" ? "bg-primary text-primary-foreground shadow-btn" : "bg-secondary text-muted-foreground"
          )}
        >
          Favoris
        </button>
        <button
          onClick={() => setTab("historique")}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "historique" ? "bg-primary text-primary-foreground shadow-btn" : "bg-secondary text-muted-foreground"
          )}
        >
          Historique
        </button>
      </div>

      {!ready ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : tab === "favoris" ? (
        /* ===== ONGLET FAVORIS ===== */
        favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <p className="text-sm font-bold">Aucun favori pour le moment</p>
            <p className="text-sm text-muted-foreground">
              Touchez le cœur d&apos;une annonce pour la retrouver ici.
            </p>
          </div>
        ) : (
          
          <div className="space-y-4 px-5 pb-8">
            <div className="flex justify-end pb-2">
            <select
              value={favSort}
              onChange={(e) => setFavSort(e.target.value as typeof favSort)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold outline-none focus:border-accent"
            >
              <option value="recent">Ajout récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
            {favorites.map((l) => (
              <ListingCard key={l.id} listing={l} initialFavorited={true} unavailable={!l.available} />
            ))}
          </div>
        )
      ) : (
        /* ===== ONGLET HISTORIQUE ===== */
        !historyLoaded ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <p className="text-sm font-bold">Aucune annonce consultée</p>
            <p className="text-sm text-muted-foreground">
              Les annonces que vous ouvrez apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-5 pb-8">
            <div className="flex justify-end">
              <button onClick={clearHistory} className="text-sm font-semibold text-destructive">
                Effacer l&apos;historique
              </button>
            </div>
            {history.map((l) => (
              <ListingCard
                key={`${l.id}-${favoriteIds.has(l.id)}`}
                listing={l}
                initialFavorited={favoriteIds.has(l.id)}
                unavailable={!l.available}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}