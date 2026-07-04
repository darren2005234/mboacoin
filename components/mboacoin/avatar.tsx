import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Génère une couleur stable à partir du nom (toujours la même pour un nom donné). */
function colorFromName(name: string): string {
  const colors = [
    "#0b5e4f", "#0e7c68", "#b7791f", "#475569",
    "#7c3aed", "#be123c", "#0369a1", "#4d7c0f",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Extrait les initiales (1 à 2 lettres) d'un nom. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Avatar : photo si disponible, sinon initiales sur fond coloré stable. */
export function Avatar({ name, src, size = 44, className }: AvatarProps) {
  if (src) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-full bg-secondary", className)}
        style={{ width: size, height: size }}
      >
        <Image src={src} alt={name} fill className="object-cover" sizes={`${size}px`} />
      </div>
    );
  }

  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-white", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFromName(name),
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </div>
  );
}