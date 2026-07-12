"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enregistre le service worker (nécessaire pour recevoir les push) et route les
 * clics sur une notification vers l'écran concerné via le router client, plutôt
 * qu'un rechargement dur. Ne demande jamais la permission de notification —
 * ça reste déclenché explicitement par PushOptInCard.
 */
export function ServiceWorkerRegistrar() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // L'absence de service worker ne doit jamais casser l'app.
    });

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "PUSH_NAVIGATE" && typeof event.data.link === "string") {
        router.push(event.data.link);
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
