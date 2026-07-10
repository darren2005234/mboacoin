"use client";

import { useEffect, useState, useRef } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { searchListings, type SearchCriteria } from "@/lib/search";
import { PROPERTY_TYPES } from "@/lib/property-types";

const FURNISHING = [
  { value: "", label: "Peu importe" },
  { value: "non_meuble", label: "Non meublé" },
  { value: "semi_meuble", label: "Semi-meublé" },
  { value: "meuble", label: "Meublé" },
];

export interface Filters {
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  minRooms: string;
  minBedrooms: string;
  furnishing: string;
  carAccess: boolean;
  verifiedOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  minPrice: "",
  maxPrice: "",
  propertyType: "",
  minRooms: "",
  minBedrooms: "",
  furnishing: "",
  carAccess: false,
  verifiedOnly: false,
};

function filtersToCriteria(f: Filters, keywords: string): SearchCriteria {
  return {
    keywords,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    propertyType: f.propertyType || undefined,
    minRooms: f.minRooms ? Number(f.minRooms) : undefined,
    minBedrooms: f.minBedrooms ? Number(f.minBedrooms) : undefined,
    furnishing: f.furnishing || undefined,
    carAccess: f.carAccess || undefined,
    verifiedOnly: f.verifiedOnly || undefined,
  };
}

export function FiltersSheet({
  open,
  onClose,
  initial,
  keywords,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  initial: Filters;
  keywords: string;
  onApply: (f: Filters) => void;
}) {
  const [filters, setFilters] = useState<Filters>(initial);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialiser à l'ouverture avec les filtres actuels
  useEffect(() => {
    if (open) setFilters(initial);
  }, [open, initial]);

  // Compter les résultats en temps réel quand les filtres changent
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCounting(true);
    debounceRef.current = setTimeout(async () => {
      const result = await searchListings(filtersToCriteria(filters, keywords));
      setCount(result.total);
      setCounting(false);
    }, 300);
  }, [filters, keywords, open]);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  if (!open) return null;

  const inputCls =
    "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Filtres</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-muted-foreground">
            <Icon name="close" size={24} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Budget */}
          <div>
            <label className="field-label">Budget (FCFA / mois)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => set("minPrice", e.target.value)}
                className={inputCls}
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => set("maxPrice", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="field-label">Type de bien</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => set("propertyType", "")}
                className={
                  filters.propertyType === ""
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
                }
              >
                Tous
              </button>
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => set("propertyType", t)}
                  className={
                    filters.propertyType === t
                      ? "rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                      : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Pièces et chambres */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Pièces (min)</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Ex : 2"
                value={filters.minRooms}
                onChange={(e) => set("minRooms", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="field-label">Chambres (min)</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Ex : 1"
                value={filters.minBedrooms}
                onChange={(e) => set("minBedrooms", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Meublé */}
          <div>
            <label className="field-label">Ameublement</label>
            <select
              value={filters.furnishing}
              onChange={(e) => set("furnishing", e.target.value)}
              className={inputCls}
            >
              {FURNISHING.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Accès voiture */}
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <input
              type="checkbox"
              checked={filters.carAccess}
              onChange={(e) => set("carAccess", e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium">Accès voiture</span>
          </label>
          <label className="flex items-center gap-2.5 rounded-xl border border-seal/30 bg-seal-bg/40 px-4 py-3">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => set("verifiedOnly", e.target.checked)}
              className="size-4 accent-seal"
            />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Icon name="verified" size={16} className="text-seal-text" /> Logements vérifiés uniquement
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Réinitialiser
          </Button>
          <Button
            size="lg"
            className="flex-[1.5]"
            onClick={() => {
              onApply(filters);
              onClose();
            }}
          >
            {counting ? "..." : `Voir ${count ?? 0} annonce${(count ?? 0) > 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}