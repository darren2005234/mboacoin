"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { ShareButton } from "@/components/mboacoin/share-button";
import { toggleFavorite } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import { loginUrl } from "@/lib/auth-redirect";

interface ListingActionsProps {
  listingId: string;
  title: string;
  initialFavorited: boolean;
  favoritesCount: number;
}

/** Boutons cœur + partage sur la fiche, façon Leboncoin. */
export function ListingActions({ listingId, title, initialFavorited, favoritesCount }: ListingActionsProps) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorited);
  const [count, setCount] = useState(favoritesCount);
  const [pending, setPending] = useState(false);

  async function toggleFav() {
    if (pending) return;
    setPending(true);
    const prev = fav;
    setFav(!prev);
    setCount((c) => (prev ? c - 1 : c + 1));
    const result = await toggleFavorite(listingId);
    if (result.error === "not-authenticated") {
      setFav(prev);
      setCount((c) => (prev ? c + 1 : c - 1));
      router.push(loginUrl());
      return;
    }
    if (result.error) {
      setFav(prev);
      setCount((c) => (prev ? c + 1 : c - 1));
    }
    setPending(false);
  }

  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
      <ShareButton title={title} />
      <button
        onClick={toggleFav}
        disabled={pending}
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="relative grid size-10 place-items-center rounded-full bg-card/85 text-muted-foreground backdrop-blur transition-colors"
      >
        <Heart className={cn("size-5", fav && "fill-fav text-fav")} />
        {count > 0 && (
          <span className="absolute -bottom-1 -right-1 grid min-w-[16px] place-items-center rounded-full bg-fav px-1 text-[9px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}