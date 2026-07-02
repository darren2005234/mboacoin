"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, MessageCircle, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/explore", label: "Explorer", icon: Compass },
  { href: "/favorites", label: "Favoris", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-1 transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("size-5", active && "fill-primary/10")} />
            <span className={cn("text-[10px]", active ? "font-bold" : "font-medium")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}