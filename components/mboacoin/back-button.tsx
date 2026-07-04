"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Bouton retour qui revient à la page précédente réelle (conversation, explore, etc.). */
export function BackButton({ fallback = "/explore" }: { fallback?: string }) {
  const router = useRouter();

  function goBack() {
    // Revient à la page précédente si elle existe, sinon vers le fallback
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={goBack}
      aria-label="Retour"
      className="absolute left-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-card/85 text-foreground backdrop-blur"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}