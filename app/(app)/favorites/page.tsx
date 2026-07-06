"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { ListingCard, type Listing } from "@/components/mboacoin/listing-card";
import { getMyFavorites } from "@/lib/favorites";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<(Listing & { available: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setFavorites(await getMyFavorites());
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Favoris" />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : !authed ? (
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <p className="text-sm font-bold">Connectez-vous pour voir vos favoris</p>
          <Link
            href="/login"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
          >
            Se connecter
          </Link>
        </div>
      ) : favorites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <p className="text-sm font-bold">Aucun favori pour le moment</p>
          <p className="text-sm text-muted-foreground">
            Touchez le cœur d&apos;une annonce pour la retrouver ici.
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-8">
          {favorites.map((l) => (
            <ListingCard key={l.id} listing={l} initialFavorited={true} unavailable={!l.available} />
          ))}
        </div>
      )}
    </div>
  );
}