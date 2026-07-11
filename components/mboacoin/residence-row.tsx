"use client";

import { ChevronRight } from "lucide-react";
import { ResidenceCardCompact, type ResidenceSearchResult } from "@/components/mboacoin/residence-card-compact";

const MAX_IN_ROW = 7; // nombre de cartes avant le "Voir tout"

export function ResidenceRow({
  title,
  residences,
  icon,
  onSeeAll,
}: {
  title: string;
  residences: ResidenceSearchResult[];
  icon?: React.ReactNode;
  onSeeAll?: () => void;
}) {
  if (residences.length === 0) return null;

  const shown = residences.slice(0, MAX_IN_ROW);
  const showSeeAll = onSeeAll && residences.length >= MAX_IN_ROW;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-5">
        {icon}
        <h2 className="text-base font-extrabold leading-tight">{title}</h2>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pl-5 pr-5">
        {shown.map((r) => (
          <div key={r.id} className="w-36 shrink-0">
            <ResidenceCardCompact residence={r} size="sm" />
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
