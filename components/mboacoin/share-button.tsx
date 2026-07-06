"use client";

import { useState } from "react";
import { Icon } from "@/components/mboacoin/icon";

interface ShareButtonProps {
  title: string;
  className?: string;
}

/** Bouton de partage : utilise le partage natif du téléphone, sinon copie le lien. */
export function ShareButton({ title, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    // Partage natif (mobile) : ouvre WhatsApp, SMS, etc.
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Découvrez cette annonce sur MboaCoin : ${title}`, url });
      } catch {
        // L'utilisateur a annulé, on ne fait rien
      }
      return;
    }
    // Repli (ordinateur sans partage natif) : copier le lien
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // rien
    }
  }

  return (
    <div className="relative">
      <button
        onClick={share}
        aria-label="Partager"
        className={
          className ??
          "grid size-10 place-items-center rounded-full bg-card/85 text-foreground backdrop-blur"
        }
      >
        <Icon name={copied ? "check" : "share"} size={20} />
      </button>
      {copied && (
        <span className="absolute -bottom-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-white shadow-soft">
          Lien copié !
        </span>
      )}
    </div>
  );
}