"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { countUnreadConversations } from "@/lib/messages";

// Onglets de gauche et de droite (le bouton Publier est au centre, à part)
const LEFT = [
  { href: "/explore", label: "Explorer", icon: "explore" },
  { href: "/favorites", label: "Favoris", icon: "favorite" },
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

  // Onglets de droite : Messages puis Profil/Connexion
  const right = [
    { href: "/messages", label: "Messages", icon: "chat_bubble" },
    lastItem,
  ];

  // Publier mène à /publish si connecté, sinon vers login
  const publishHref = isAuthenticated ? "/publish" : "/login";
  const publishActive = pathname === "/publish";

  function renderTab({ href, label, icon }: { href: string; label: string; icon: string }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    const showBadge = href === "/messages" && unread > 0;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center gap-1 rounded-lg py-1 transition-colors",
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
  }

  return (
    <nav className="flex items-end justify-around border-t border-border bg-card px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5">
      {LEFT.map(renderTab)}

      {/* Bouton Publier central, proéminent */}
      <Link
        href={publishHref}
        aria-label="Publier une annonce"
        aria-current={publishActive ? "page" : undefined}
        className="relative flex flex-1 flex-col items-center"
      >
        <span
          className={cn(
            "-mt-6 grid size-14 place-items-center rounded-full border-4 border-card shadow-btn transition-transform active:scale-95",
            "bg-primary text-primary-foreground"
          )}
        >
          <Icon name="add" size={28} />
        </span>
        <span className={cn("mt-0.5 text-[11px]", publishActive ? "font-bold text-primary" : "font-medium text-muted-foreground")}>
          Publier
        </span>
      </Link>

      {right.map(renderTab)}
    </nav>
  );
}