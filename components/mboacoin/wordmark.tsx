import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: "sm" | "md";
  className?: string;
}

/** Logo MboaCoin : pastille teal frappée d'une pièce, « Mboa » en ink, « Coin » en teal. */
export function Wordmark({ size = "md", className }: WordmarkProps) {
  const box = size === "sm" ? "size-7" : "size-9";
  const text = size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("grid place-items-center rounded-xl bg-primary text-primary-foreground", box)}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M9 12.5l2 2 4-4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={cn("font-extrabold tracking-tight", text)}>
        <span className="text-foreground">Mboa</span>
        <span className="text-primary">Coin</span>
      </span>
    </span>
  );
}