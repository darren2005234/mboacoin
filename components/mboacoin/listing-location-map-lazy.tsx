"use client";

import dynamic from "next/dynamic";

/**
 * Leaflet touche `window` dès l'import : ssr:false n'est permis que depuis
 * un Client Component (jamais directement dans un Server Component comme
 * app/(app)/listings/[id]/page.tsx) — ce fichier existe uniquement pour ça.
 */
export const ListingLocationMapLazy = dynamic(
  () => import("@/components/mboacoin/listing-location-map").then((m) => m.ListingLocationMap),
  { ssr: false }
);
