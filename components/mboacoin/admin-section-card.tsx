import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";

export function AdminSectionCard({
  icon,
  label,
  description,
  href,
  count,
}: {
  icon: string;
  label: string;
  description: string;
  href: string;
  count?: number;
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <span className="flex items-center gap-3">
        <Icon name={icon} size={22} className="text-muted-foreground" filled={false} />
        <span>
          <span className="block text-sm font-bold">{label}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        {count != null && count > 0 && (
          <span className="grid min-w-6 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-white">
            {count}
          </span>
        )}
        <Icon name="chevron_right" size={20} className="text-muted-foreground" />
      </span>
    </Link>
  );
}
