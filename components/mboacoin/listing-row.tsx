"use client";

import { ChevronRight } from "lucide-react";
import { ListingCardCompact } from "@/components/mboacoin/listing-card-compact";
import type { Listing } from "@/components/mboacoin/listing-card";

const MAX_IN_ROW = 7; // nombre de cartes avant le "Voir tout"

export function ListingRow({
  title,
  listings,
  favoriteIds,
  icon,
  onSeeAll,
}: {
  title: string;
  listings: Listing[];
  favoriteIds: Set<string>;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
}) {
  if (listings.length === 0) return null;

  // On n'affiche qu'un nombre limité de cartes dans la rangée
  const shown = listings.slice(0, MAX_IN_ROW);
  // Le "Voir tout" apparaît s'il y a une action ET qu'il y a potentiellement plus à voir
  const showSeeAll = onSeeAll && listings.length >= MAX_IN_ROW;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-5">
        {icon}
        <h2 className="text-base font-extrabold leading-tight">{title}</h2>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pl-5 pr-5">
        {shown.map((l) => (
          <div key={`${l.id}-${favoriteIds.has(l.id)}`} className="w-36 shrink-0">
            <ListingCardCompact listing={l} initialFavorited={favoriteIds.has(l.id)} size="sm" />
          </div>
        ))}

        {showSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 text-primary"
          >
            <span className="grid size-11 place-items-center rounded-full bg-primary/10">
              <ChevronRight className="size-6" />
            </span>
            <span className="text-sm font-bold">Voir tout</span>
          </button>
        )}
      </div>
    </section>
  );
}