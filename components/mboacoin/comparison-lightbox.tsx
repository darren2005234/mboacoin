"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useImageZoomPan } from "@/lib/use-image-zoom-pan";

interface ComparisonLightboxProps {
  entreeLabel?: string;
  sortieLabel?: string;
  entreeImages: string[];
  sortieImages: string[];
  onClose: () => void;
  /** Voir Lightbox : à activer pour des URL signées. */
  unoptimized?: boolean;
}

/**
 * Visionneuse à deux volets (entrée / sortie) pour comparer réellement les
 * photos d'une même pièce en grand. Même châssis anti-piège PWA que
 * Lightbox : overlay interne à la page, bouton fermer toujours visible,
 * jamais de navigation/nouvel onglet.
 */
export function ComparisonLightbox({
  entreeLabel = "Entrée",
  sortieLabel = "Sortie",
  entreeImages,
  sortieImages,
  onClose,
  unoptimized = false,
}: ComparisonLightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-white/15 text-white"
      >
        <X className="size-5" />
      </button>

      <div
        className="flex h-full w-full flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <Pane label={entreeLabel} images={entreeImages} unoptimized={unoptimized} />
        <div className="h-px w-full bg-white/10 sm:h-full sm:w-px" />
        <Pane label={sortieLabel} images={sortieImages} unoptimized={unoptimized} />
      </div>
    </div>
  );
}

function Pane({ label, images, unoptimized }: { label: string; images: string[]; unoptimized: boolean }) {
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const next = () => setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  const { scale, style: zoomStyle, handlers } = useImageZoomPan({ onPrev: prev, onNext: next, resetKey: index });

  return (
    <div className="relative flex h-1/2 min-h-0 w-full flex-col sm:h-full sm:w-1/2">
      <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white/80">
        <span>{label}</span>
        {images.length > 1 && (
          <span className="text-white/50">
            · {index + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-white/50">Pas de photo</div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden" {...handlers}>
          <div className="relative h-full w-full" style={zoomStyle}>
            <Image
              src={images[index]}
              alt=""
              fill
              className="object-contain"
              sizes="50vw"
              unoptimized={unoptimized}
              draggable={false}
            />
          </div>

          {images.length > 1 && scale === 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label={`Photo précédente (${label})`}
                className="absolute left-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label={`Photo suivante (${label})`}
                className="absolute right-2 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
