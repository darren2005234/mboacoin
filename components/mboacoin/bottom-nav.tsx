"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/mboacoin/icon";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  isAuthenticated: boolean;
}

export function BottomNav({ isAuthenticated }: BottomNavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/explore", label: "Explorer", icon: "explore" },
    { href: "/favorites", label: "Favoris", icon: "favorite" },
    { href: "/messages", label: "Messages", icon: "chat_bubble" },
    isAuthenticated
      ? { href: "/profile", label: "Profil", icon: "person" }
      : { href: "/login", label: "Connexion", icon: "login" },
  ];

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-1 transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon name={icon} size={24} filled={active} />
            <span className={cn("text-[11px]", active ? "font-bold" : "font-medium")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}