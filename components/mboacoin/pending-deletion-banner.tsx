"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";

interface PendingDeletionBannerProps {
  scheduledFor: string | null;
}

/**
 * Rappel persistant qu'une suppression de compte est en attente, avec un
 * accès direct à l'annulation — c'est le lien que les gardes en base
 * (listings/leases/visits/conversations) renvoient en toutes lettres dans
 * leurs messages d'erreur, affiché ici de façon continue plutôt que
 * seulement au moment d'un blocage.
 */
export function PendingDeletionBanner({ scheduledFor }: PendingDeletionBannerProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (!scheduledFor || pathname.startsWith("/profile/delete-account")) return null;

  const date = new Date(scheduledFor).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <button
      onClick={() => router.push("/profile/delete-account")}
      className="flex w-full shrink-0 items-center gap-2 bg-destructive/10 px-4 py-2.5 text-left text-xs font-bold text-destructive"
    >
      <Icon name="hourglass_top" size={16} filled={false} />
      <span className="flex-1">Suppression de compte prévue le {date} — Annuler</span>
      <Icon name="chevron_right" size={16} />
    </button>
  );
}
