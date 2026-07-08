"use client";

import * as React from "react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Price } from "./price";
import { TrustSeal } from "./trust-seal";
import { toggleFavorite } from "@/lib/favorites";
import type { Listing } from "./listing-card";

interface Props {
  listing: Listing;
  initialFavorited?: boolean;
  unavailable?: boolean;
  size?: "sm" | "md";
}



/** Carte compacte : pour la grille 2 colonnes et les rangées horizontales. */
export function ListingCardCompact({ listing, initialFavorited, unavailable, size = "md" }: Props) {
  const router = useRouter();
  const [fav, setFav] = useState(Boolean(initialFavorited));
  const [pending, setPending] = useState(false);

  function open() {
    router.push(`/listings/${listing.id}`);
  }

  async function toggleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const prev = fav;
    setFav(!prev);
    const result = await toggleFavorite(listing.id);
    if (result.error === "not-authenticated") {
      setFav(prev);
      router.push("/login");
      return;
    }
    if (result.error) setFav(prev);
    setPending(false);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-soft"
    >
      <div className={cn("relative bg-secondary", size === "sm" ? "h-24" : "h-32")}>
        <Image
          src={listing.image}
          alt=""
          fill
          className={cn("object-cover", unavailable && "opacity-40 grayscale")}
          sizes="(max-width:768px) 50vw, 256px"
        />
        {unavailable && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 px-3 py-1 text-[11px] font-bold text-white">
            Louée
          </span>
        )}
        {listing.verified && !unavailable && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[9px] font-bold text-seal-text backdrop-blur">
            <TrustSeal size={11} /> Vérifiée
          </span>
        )}
        <button
          type="button"
          aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={fav}
          onClick={toggleFav}
          disabled={pending}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-card/85 text-muted-foreground backdrop-blur transition-colors hover:text-fav"
        >
          <Heart className={cn("size-3.5", fav && "fill-fav text-fav")} />
        </button>
      </div>
      <div className="space-y-1 p-2.5">
        <Price amount={listing.price} suffix={listing.priceSuffix} size="sm" />
        <h3 className="line-clamp-1 text-sm font-bold">{listing.title}</h3>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">{listing.location}</span>
        </p>
      </div>
    </article>
  );
}