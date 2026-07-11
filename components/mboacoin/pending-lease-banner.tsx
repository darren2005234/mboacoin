"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";

interface PendingLeaseBannerProps {
  count: number;
}

/**
 * Rappel persistant qu'un bail attend confirmation. Ne redirige jamais (pas de
 * piège) : c'est un simple lien, affiché sur toutes les pages sauf la page de
 * confirmation elle-même, tant que le locataire n'a pas tranché.
 */
export function PendingLeaseBanner({ count }: PendingLeaseBannerProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (count === 0 || pathname.startsWith("/my-lease/confirm")) return null;

  return (
    <button
      onClick={() => router.push("/my-lease/confirm")}
      className="flex w-full shrink-0 items-center gap-2 bg-pending-bg px-4 py-2.5 text-left text-xs font-bold text-pending-text"
    >
      <Icon name="key" size={16} />
      <span className="flex-1">
        {count > 1 ? `${count} baux vous attendent` : "Un bail vous attend"} — à confirmer
      </span>
      <Icon name="chevron_right" size={16} />
    </button>
  );
}
