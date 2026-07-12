"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import {
  getNotificationPermission,
  isPushSupported,
  isSubscribedToPush,
  subscribeToPush,
} from "@/lib/push-subscriptions";

export type PushOptInContext = "lease_confirmed" | "lease_created" | "first_message";

const COPY: Record<PushOptInContext, string> = {
  lease_confirmed:
    "Soyez prévenu quand votre bailleur déclare un paiement ou répond à vos demandes.",
  lease_created: "Soyez prévenu dès que votre locataire confirme le bail.",
  first_message: "Ne manquez aucun message.",
};

const DISMISSED_KEY = "mboacoin:push-opt-in-dismissed";

/**
 * Encart MboaCoin proposant l'activation des notifications push, affiché à des
 * moments contextuels précis (jamais au chargement de l'app). Ne déclenche la
 * demande de permission native que si l'utilisateur clique "Activer" — un refus
 * dans le navigateur est très difficile à récupérer, donc on ne le provoque pas
 * à la légère. Un "Plus tard" masque l'encart partout, pas seulement ici.
 */
export function PushOptInCard({ context }: { context: PushOptInContext }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isPushSupported()) return;
      if (getNotificationPermission() === "denied") return;
      if (localStorage.getItem(DISMISSED_KEY)) return;
      if (await isSubscribedToPush()) return;
      if (!cancelled) setVisible(true);
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function activate() {
    setPending(true);
    try {
      await subscribeToPush();
    } finally {
      setPending(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="mx-5 mb-4 flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3.5 ring-1 ring-brand-500/20">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Icon name="notifications_active" size={18} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{COPY[context]}</p>
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" onClick={activate} disabled={pending}>
            Activer
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} disabled={pending}>
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}
