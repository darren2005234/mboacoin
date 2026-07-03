"use client";

import { useState } from "react";
import Image from "next/image";

interface GalleryProps {
  images: string[];
  alt?: string;
}

/** Galerie photo défilante avec pastilles de position. */
export function Gallery({ images, alt = "" }: GalleryProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <div className="h-60 w-full bg-secondary" />;
  }

  return (
    <div className="relative h-60 w-full shrink-0 overflow-hidden bg-secondary">
      {/* Piste défilante horizontale */}
      <div
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          setIndex(i);
        }}
      >
        {images.map((src, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes="448px"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Pastilles de position */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={
                i === index
                  ? "size-2 rounded-full bg-white"
                  : "size-2 rounded-full bg-white/50"
              }
            />
          ))}
        </div>
      )}

      {/* Compteur */}
      <span className="absolute right-3 top-3 rounded-lg bg-foreground/60 px-2 py-1 text-[11px] font-medium text-white">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}