import { Logo } from "@/components/mboacoin/logo";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: "sm" | "md";
  className?: string;
}

/** Logo MboaCoin (sceau doré inclus) accompagné du texte « Mboa » en ink, « Coin » en teal. */
export function Wordmark({ size = "md", className }: WordmarkProps) {
  const logoSize = size === "sm" ? 32 : 40;
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={logoSize} />
      <span className={cn("font-extrabold tracking-tight", text)}>
        <span className="text-foreground">Mboa</span>
        <span className="text-primary">Coin</span>
      </span>
    </span>
  );
}