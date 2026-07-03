import { cn } from "@/lib/utils";

interface IconProps {
  /** Nom du symbole Material (ex: "home", "notifications", "favorite"). */
  name: string;
  /** Taille en pixels. */
  size?: number;
  /** Rempli ou contour. Par défaut rempli. */
  filled?: boolean;
  className?: string;
}

/** Icône Material Symbols (rounded), auto-hébergée. Remplie par défaut. */
export function Icon({ name, size = 24, filled = true, className }: IconProps) {
  return (
    <span
      aria-hidden
      className={cn("material-symbols-rounded leading-none select-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}