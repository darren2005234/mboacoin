import { Icon } from "@/components/mboacoin/icon";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: "sm" | "md";
  className?: string;
}

/** Logo MboaCoin : pastille teal avec une maison, « Mboa » en ink, « Coin » en teal. */
export function Wordmark({ size = "md", className }: WordmarkProps) {
  const box = size === "sm" ? "size-8" : "size-10";
  const text = size === "sm" ? "text-base" : "text-lg";
  const iconSize = size === "sm" ? 18 : 22;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("grid place-items-center rounded-xl bg-primary text-primary-foreground", box)}>
        <Icon name="home" size={iconSize} />
      </span>
      <span className={cn("font-extrabold tracking-tight", text)}>
        <span className="text-foreground">Mboa</span>
        <span className="text-primary">Coin</span>
      </span>
    </span>
  );
}