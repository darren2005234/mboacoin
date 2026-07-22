"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAllNotifications,
  deleteNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications";
import { formatRelativeDate } from "@/lib/format-date";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function NotificationsPage() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearAll, setShowClearAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const supabase = createClient();

    async function load() {
      const data = await getMyNotifications();
      setNotifications(data);
      setLoading(false);
      if (data.some((n) => !n.readAt)) {
        await markAllNotificationsRead();
      }
    }

    load();

    const channel = supabase
      .channel("notifications-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready]);

  if (!ready) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  async function onClickNotification(n: Notification) {
    if (!n.readAt) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      await markNotificationRead(n.id);
    }
    if (n.link) router.push(n.link);
  }

  async function onMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  async function onDeleteNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  }

  async function onClearAll() {
    setClearing(true);
    setNotifications([]);
    await deleteAllNotifications();
    setClearing(false);
    setShowClearAll(false);
  }

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Notifications" />

      {notifications.length > 0 && (
        <div className="flex justify-end gap-2 px-5 pb-4">
          {hasUnread && (
            <button
              onClick={onMarkAllRead}
              className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground"
            >
              Tout marquer comme lu
            </button>
          )}
          <button
            onClick={() => setShowClearAll(true)}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground"
          >
            Tout effacer
          </button>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <p className="text-sm font-bold">Aucune notification</p>
          <p className="text-sm text-muted-foreground">
            Vous serez prévenu ici des événements qui vous concernent.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {notifications.map((n) => (
            <li key={n.id} className="group relative flex items-stretch">
              <button
                onClick={() => onClickNotification(n)}
                className="flex w-full items-start gap-3 py-3.5 pl-5 pr-12 text-left transition-colors hover:bg-secondary"
              >
                {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={
                        n.readAt
                          ? "line-clamp-1 text-sm font-bold text-foreground"
                          : "line-clamp-1 text-sm font-extrabold text-foreground"
                      }
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRelativeDate(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNotification(n.id);
                }}
                aria-label="Supprimer la notification"
                className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              >
                <Icon name="delete" size={18} filled={false} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showClearAll && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !clearing && setShowClearAll(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold">Effacer toutes les notifications ?</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Cette action est irréversible. Toutes vos notifications seront définitivement supprimées.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setShowClearAll(false)}
                disabled={clearing}
              >
                Annuler
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                onClick={onClearAll}
                disabled={clearing}
              >
                {clearing ? "Suppression..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
