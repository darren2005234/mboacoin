"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useImageZoomPan } from "@/lib/use-image-zoom-pan";

interface LightboxProps {
  images: string[];
  startIndex?: number;
  onClose: () => void;
  /**
   * À activer pour les images issues d'URL signées (privées) : évite de les
   * faire transiter par le proxy/cache /_next/image, qui embarquerait le
   * jeton signé dans une autre URL sans apporter de bénéfice pour du
   * contenu déjà à durée de vie courte. Même logique que les <Image> déjà
   * marquées unoptimized sur les documents de vérification admin.
   */
  unoptimized?: boolean;
}

/** Visualiseur plein écran d'images : navigation, pincement/pan et double-tap au toucher. */
export function Lightbox({ images, startIndex = 0, onClose, unoptimized = false }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);

  const prev = () => setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const next = () => setIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  const { scale, style: zoomStyle, handlers } = useImageZoomPan({ onPrev: prev, onNext: next, resetKey: index });

  // Fermer avec Échap, naviguer avec les flèches du clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    // Empêche le défilement de l'arrière-plan
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* Fermer : toujours visible, quel que soit le zoom — c'est la seule
          issue garantie en PWA installée, où il n'y a ni barre d'adresse ni
          bouton retour du navigateur. */}
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-white/15 text-white"
      >
        <X className="size-5" />
      </button>

      {/* Compteur */}
      {images.length > 1 && (
        <span className="absolute top-5 left-1/2 -translate-x-1/2 z-10 text-sm font-medium text-white/80">
          {index + 1} / {images.length}
        </span>
      )}

      {/* Image : pincement/pan/balayage/double-tap au toucher ; clic simple
          stoppé pour ne pas fermer en tapant l'image elle-même. */}
      <div
        className="relative h-full max-h-[80vh] w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        {...handlers}
      >
        <div className="relative h-full w-full" style={zoomStyle}>
          <Image
            src={images[index]}
            alt=""
            fill
            className="object-contain"
            sizes="100vw"
            priority
            unoptimized={unoptimized}
            draggable={false}
          />
        </div>
      </div>

      {/* Navigation (repli souris/clavier ; le balayage tactile fonctionne aussi) */}
      {images.length > 1 && scale === 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Précédent"
            className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Suivant"
            className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}
    </div>
  );
}