"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { countUnreadConversations } from "@/lib/messages";

const NAV = [
  { href: "/explore", label: "Explorer", icon: "explore" },
  { href: "/favorites", label: "Favoris", icon: "favorite" },
  { href: "/messages", label: "Messages", icon: "chat_bubble" },
];

export function BottomNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const supabase = createClient();

    async function refresh() {
      setUnread(await countUnreadConversations());
    }

    refresh();

    const channel = supabase
      .channel("nav-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, pathname]);

  const lastItem = isAuthenticated
    ? { href: "/profile", label: "Profil", icon: "person" }
    : { href: "/login", label: "Connexion", icon: "login" };

  const items = [...NAV, lastItem];

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const showBadge = href === "/messages" && unread > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-lg px-3 py-1 transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span className="relative">
              <Icon name={icon} size={24} filled={active} />
              {showBadge && (
                <span className="absolute -right-2 -top-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </span>
            <span className={cn("text-[11px]", active ? "font-bold" : "font-medium")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}