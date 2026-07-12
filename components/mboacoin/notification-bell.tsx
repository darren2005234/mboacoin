"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationsCount } from "@/lib/notifications";

/** Cloche de notifications avec badge de non-lues, mise à jour en temps réel. */
export function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      setUnread(await getUnreadNotificationsCount());
    }

    refresh();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative grid size-11 place-items-center rounded-full bg-secondary text-foreground"
    >
      <Icon name="notifications" size={22} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
