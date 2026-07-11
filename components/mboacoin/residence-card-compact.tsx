"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustSeal } from "./trust-seal";
import { Icon } from "@/components/mboacoin/icon";

export interface ResidenceSearchResult {
  id: string;
  name: string;
  location: string;
  imageUrl: string | null;
  managerVerified: boolean;
  availableCount: number;
}

interface Props {
  residence: ResidenceSearchResult;
  size?: "sm" | "md";
}

/** Carte compacte résidence : même style que ListingCardCompact. */
export function ResidenceCardCompact({ residence, size = "md" }: Props) {
  const router = useRouter();

  function open() {
    router.push(`/residences/${residence.id}`);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-soft"
    >
      <div className={cn("relative bg-secondary", size === "sm" ? "h-24" : "h-32")}>
        <Image
          src={residence.imageUrl ?? "/img/listings/demo-1.jpg"}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width:768px) 50vw, 256px"
        />
        {residence.managerVerified && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[9px] font-bold text-seal-text backdrop-blur">
            <TrustSeal size={11} /> Vérifiée
          </span>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <h3 className="line-clamp-1 text-sm font-bold">{residence.name}</h3>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">{residence.location}</span>
        </p>
        <p className="flex items-center gap-1 text-[11px] font-medium text-accent">
          <Icon name="apartment" size={12} />
          {residence.availableCount} logement{residence.availableCount > 1 ? "s" : ""} disponible
          {residence.availableCount > 1 ? "s" : ""}
        </p>
      </div>
    </article>
  );
}
