import * as React from "react";
import { cn } from "@/lib/utils";

type SealTone = "verified" | "pending";

interface TrustSealProps {
  /** Diamètre du sceau en pixels. */
  size?: number;
  /** verified = doré actif, pending = grisé en attente. */
  tone?: SealTone;
  className?: string;
  title?: string;
}

/**
 * Le sceau MboaCoin : élément signature du produit.
 * Une pièce dentelée (le « Coin ») frappée d'une coche, qui matérialise
 * la confiance vérifiée sur les annonces et les profils.
 */
export function TrustSeal({
  size = 20,
  tone = "verified",
  className,
  title = "Vérifié",
}: TrustSealProps) {
  const gid = React.useId();
  const active = tone === "verified";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={active ? "#D9A63A" : "#C9D2CD"} />
          <stop offset="1" stopColor={active ? "#8A5E14" : "#9FACA6"} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M12 1.4l2.05 1.36 2.44-.36 1.1 2.2 2.2 1.1-.36 2.44L22.6 12l-1.36 2.05.36 2.44-2.2 1.1-1.1 2.2-2.44-.36L12 22.6l-2.05-1.36-2.44.36-1.1-2.2-2.2-1.1.36-2.44L1.4 12l1.36-2.05-.36-2.44 2.2-1.1 1.1-2.2 2.44.36L12 1.4z"
      />
      <circle cx="12" cy="12" r="7.1" fill={active ? "#FBF1D9" : "#F1F4F2"} />
      <path
        d="M8.7 12.2l2.2 2.2 4.4-4.6"
        fill="none"
        stroke={active ? "#8A5E14" : "#7C8B84"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Étiquette complète (sceau + libellé), pour un profil vérifié. */
export function TrustSealBadge({
  label = "Profil vérifié",
  tone = "verified",
  className,
}: {
  label?: string;
  tone?: SealTone;
  className?: string;
}) {
  const verified = tone === "verified";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-bold",
        verified
          ? "border-seal-line bg-seal-bg text-seal-text"
          : "border-border bg-secondary text-muted-foreground",
        className
      )}
    >
      <TrustSeal size={16} tone={tone} title={label} />
      {label}
    </span>
  );
}