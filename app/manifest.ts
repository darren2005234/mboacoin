import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MboaCoin",
    short_name: "MboaCoin",
    description:
      "Annonces vérifiées, acompte protégé et visites planifiées. L'immobilier locatif sécurisé au Cameroun.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b5e4f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
