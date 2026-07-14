"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/mboacoin/lightbox";

/** Photo de couverture d'une résidence, agrandissable en plein écran. */
export function ResidenceHeroImage({ src, alt = "" }: { src: string; alt?: string }) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} aria-label="Agrandir la photo" className="absolute inset-0">
        <Image src={src} alt={alt} fill className="object-cover" sizes="100vw" />
      </button>

      {zoomed && <Lightbox images={[src]} onClose={() => setZoomed(false)} />}
    </>
  );
}
