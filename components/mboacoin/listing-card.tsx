"use client";

import * as React from "react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, MapPin, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";
import { Price } from "./price";
import { TrustSeal } from "./trust-seal";
import { toggleFavorite } from "@/lib/favorites";
import { Icon } from "@/components/mboacoin/icon";

export interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  priceSuffix?: string;
  image: string;
  verified?: boolean;
  bedrooms?: number;
  favorite?: boolean;
  bathrooms?: number;
  rooms?: number;
  area?: number;
  propertyVerified?: boolean;
  residenceId?: string;
  residenceName?: string;
}

interface ListingCardProps {
  listing: Listing;
  onOpen?: (id: string) => void;
  className?: string;
  initialFavorited?: boolean;
  unavailable?: boolean;
}

/** Carte d'annonce. Sceau doré si vérifiée, prix en Space Grotesk, navigation intégrée. */
export function ListingCard({ listing, onOpen, className, initialFavorited, unavailable }: ListingCardProps) {
  const router = useRouter();
  const [fav, setFav] = useState(Boolean(initialFavorited));
  const [pending, setPending] = useState(false);

  function open() {
    if (onOpen) onOpen(listing.id);
    else router.push(`/listings/${listing.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  }

  async function toggleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const prev = fav;
    setFav(!prev); // mise à jour optimiste (immédiate à l'écran)
    const result = await toggleFavorite(listing.id);
    if (result.error === "not-authenticated") {
      setFav(prev);
      router.push("/login");
      return;
    }
    if (result.error) {
      setFav(prev); // on annule en cas d'erreur
    }
    setPending(false);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      className={cn(
        "cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-soft",
        className
      )}
    >
      <div className="relative h-44 bg-secondary">
        <Image
          src={listing.image}
          alt=""
          fill
          className={cn("object-cover", unavailable && "opacity-40 grayscale")}
          sizes="(max-width:768px) 100vw, 360px"
        />
        {unavailable && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 px-4 py-1.5 text-xs font-bold text-white">
            Louée
          </span>
        )}
        {listing.verified && !unavailable && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 text-[10px] font-bold text-seal-text backdrop-blur">
            <TrustSeal size={13} /> Vérifiée
          </span>
        )}
        <button
          type="button"
          aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={fav}
          onClick={toggleFav}
          disabled={pending}
          className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-card/85 text-muted-foreground backdrop-blur transition-colors hover:text-fav"
        >
          <Heart className={cn("size-4", fav && "fill-fav text-fav")} />
        </button>
      </div>
      <div className="space-y-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold">{listing.title}</h3>
          <Price amount={listing.price} suffix={listing.priceSuffix} size="sm" />
        </div>
        <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <MapPin className="size-3" /> {listing.location}
        </p>
        {listing.residenceName && (
          <p className="flex items-center gap-1 text-[12px] font-medium text-accent">
            <Icon name="apartment" size={13} /> <span className="line-clamp-1">{listing.residenceName}</span>
          </p>
        )}
        {(listing.area || listing.rooms || listing.bedrooms || listing.bathrooms) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[13px] font-medium text-foreground/70">
            {listing.area ? (
              <span className="flex items-center gap-1">
                <Icon name="straighten" size={15} className="text-accent" /> {listing.area} m²
              </span>
            ) : null}
            {listing.rooms ? (
              <span className="flex items-center gap-1">
                <Icon name="meeting_room" size={15} className="text-accent" /> {listing.rooms} pièce{listing.rooms > 1 ? "s" : ""}
              </span>
            ) : null}
            {listing.bedrooms ? (
              <span className="flex items-center gap-1">
                <Icon name="bed" size={15} className="text-accent" /> {listing.bedrooms}
              </span>
            ) : null}
            {listing.bathrooms ? (
              <span className="flex items-center gap-1">
                <Icon name="bathtub" size={15} className="text-accent" /> {listing.bathrooms}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}