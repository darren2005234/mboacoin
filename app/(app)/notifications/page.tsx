"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { createClient } from "@/lib/supabase/client";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications";
import { formatRelativeDate } from "@/lib/format-date";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      setNotifications(await getMyNotifications());
      setLoading(false);
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
  }, []);

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

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Notifications" />

      {hasUnread && (
        <div className="flex justify-end px-5 pb-4">
          <button
            onClick={onMarkAllRead}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground"
          >
            Tout marquer comme lu
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
            <li key={n.id}>
              <button
                onClick={() => onClickNotification(n)}
                className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
