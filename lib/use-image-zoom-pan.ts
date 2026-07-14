"use client";

import { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

export interface UseImageZoomPanOptions {
  /** Appelé quand un balayage vers la droite dépasse le seuil (photo précédente). */
  onPrev: () => void;
  /** Appelé quand un balayage vers la gauche dépasse le seuil (photo suivante). */
  onNext: () => void;
  /** Change à chaque photo affichée : réinitialise zoom/pan automatiquement. */
  resetKey: unknown;
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  swipeThreshold?: number;
}

const DOUBLE_TAP_DELAY_MS = 300;
const TAP_MOVE_TOLERANCE = 10;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function center(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Pincement / pan / balayage / double-tap pour une image plein écran, via
 * Pointer Events (un seul modèle doigt + souris). Aucune dépendance externe :
 * le projet n'a pas de librairie de geste, cohérent avec les autres overlays
 * faits main (lightbox.tsx, camera-capture.tsx...).
 */
export function useImageZoomPan({
  onPrev,
  onNext,
  resetKey,
  minScale = 1,
  maxScale = 4,
  doubleTapScale = 2.5,
  swipeThreshold = 60,
}: UseImageZoomPanOptions) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({
    mode: "none" as "none" | "pan" | "pinch" | "swipe",
    startDistance: 0,
    startScale: 1,
    startTranslate: { x: 0, y: 0 } as Point,
    startPoint: { x: 0, y: 0 } as Point,
    startCenter: { x: 0, y: 0 } as Point,
  });
  const lastTap = useRef<{ time: number } | null>(null);

  // Nouvelle photo affichée : on repart toujours de 1x centré.
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    pointers.current.clear();
    gesture.current.mode = "none";
  }, [resetKey]);

  function clampScale(s: number) {
    return Math.min(maxScale, Math.max(minScale, s));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsGesturing(true);

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current.mode = "pinch";
      gesture.current.startDistance = distance(a, b);
      gesture.current.startScale = scale;
      gesture.current.startCenter = center(a, b);
      gesture.current.startTranslate = translate;
    } else if (pointers.current.size === 1) {
      gesture.current.startPoint = { x: e.clientX, y: e.clientY };
      gesture.current.startTranslate = translate;
      gesture.current.mode = scale > 1 ? "pan" : "swipe";
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture.current.mode === "pinch" && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = distance(a, b);
      const nextScale = clampScale(gesture.current.startScale * (dist / (gesture.current.startDistance || dist)));
      setScale(nextScale);
      // Garde le point médian du pincement à peu près fixe à l'écran.
      const mid = center(a, b);
      setTranslate({
        x: gesture.current.startTranslate.x + (mid.x - gesture.current.startCenter.x),
        y: gesture.current.startTranslate.y + (mid.y - gesture.current.startCenter.y),
      });
      return;
    }

    if (gesture.current.mode === "pan" && pointers.current.size === 1) {
      const p = pointers.current.get(e.pointerId)!;
      setTranslate({
        x: gesture.current.startTranslate.x + (p.x - gesture.current.startPoint.x),
        y: gesture.current.startTranslate.y + (p.y - gesture.current.startPoint.y),
      });
    }
    // mode "swipe" : pas de suivi visuel en direct, juste mesuré à la levée du doigt.
  }

  function endGesture(e: React.PointerEvent) {
    const mode = gesture.current.mode;

    let dx = 0;
    if (mode === "swipe" && pointers.current.size === 1) {
      const p = pointers.current.get(e.pointerId);
      if (p) dx = p.x - gesture.current.startPoint.x;
    }

    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 1) {
      // Un doigt reste après un pincement à deux doigts : repart en pan/balayage.
      const [[, p]] = Array.from(pointers.current.entries());
      gesture.current.startPoint = p;
      gesture.current.startTranslate = translate;
      gesture.current.mode = scale > 1 ? "pan" : "swipe";
      return;
    }

    if (pointers.current.size > 0) return;

    setIsGesturing(false);
    gesture.current.mode = "none";

    if (mode === "pinch") {
      if (scale <= minScale + 0.05) {
        setScale(minScale);
        setTranslate({ x: 0, y: 0 });
      }
      return;
    }

    if (mode === "swipe") {
      if (Math.abs(dx) > swipeThreshold) {
        if (dx > 0) onPrev();
        else onNext();
        return;
      }
      if (Math.abs(dx) <= TAP_MOVE_TOLERANCE) {
        const now = Date.now();
        if (lastTap.current && now - lastTap.current.time < DOUBLE_TAP_DELAY_MS) {
          setScale((s) => (s > 1 ? 1 : doubleTapScale));
          setTranslate({ x: 0, y: 0 });
          lastTap.current = null;
        } else {
          lastTap.current = { time: now };
        }
      }
    }
  }

  const style: React.CSSProperties = {
    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    transition: isGesturing ? "none" : "transform 150ms ease-out",
    touchAction: "none",
  };

  return {
    scale,
    style,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
    },
  };
}
