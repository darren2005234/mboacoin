import { cn, formatFCFA } from "@/lib/utils";

interface PriceProps {
  /** Montant en francs CFA. */
  amount: number;
  /** Suffixe optionnel, ex. "/ mois". */
  suffix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

/** Affiche un montant en FCFA. Les chiffres sont toujours en Space Grotesk (font-mono). */
export function Price({ amount, suffix, size = "md", className }: PriceProps) {
  return (
    <span className={cn("font-mono font-bold text-primary tabular-nums", sizeMap[size], className)}>
      {formatFCFA(amount)}
      <span className="text-muted-foreground"> F</span>
      {suffix ? (
        <span className="ml-1 text-xs font-medium text-muted-foreground">{suffix}</span>
      ) : null}
    </span>
  );
}