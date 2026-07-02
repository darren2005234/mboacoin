import { cn } from "@/lib/utils";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/** En-tête d'écran standard : titre + sous-titre aux dimensions "vraie app". */
export function ScreenHeader({ title, subtitle, className }: ScreenHeaderProps) {
  return (
    <div className={cn("px-5 pt-6 pb-4", className)}>
      <h1 className="screen-title">{title}</h1>
      {subtitle ? <p className="screen-subtitle mt-1">{subtitle}</p> : null}
    </div>
  );
}