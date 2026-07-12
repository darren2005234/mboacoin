"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Switch } from "@/components/ui/switch";
import {
  getNotificationPermission,
  isPushSupported,
  isSubscribedToPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-subscriptions";

export default function SettingsPage() {
  const [supported, setSupported] = useState(true);
  const [denied, setDenied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isPushSupported()) {
        setSupported(false);
        setLoading(false);
        return;
      }
      setDenied(getNotificationPermission() === "denied");
      setEnabled(await isSubscribedToPush());
      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle(next: boolean) {
    setPending(true);
    try {
      if (next) {
        const ok = await subscribeToPush();
        setEnabled(ok);
        setDenied(getNotificationPermission() === "denied");
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Paramètres" />

      <div className="px-5">
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3.5">
          <div className="pr-4">
            <p className="text-[15px] font-semibold">Notifications push</p>
            <p className="text-sm text-muted-foreground">
              {!supported
                ? "Non disponible sur ce navigateur."
                : denied
                  ? "Bloquées dans les réglages de votre navigateur."
                  : "Messages, baux et demandes, même app fermée."}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={!supported || denied || loading || pending}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
