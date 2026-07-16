"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import {
  getAuditLog,
  getAuditLogActors,
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  type AuditLogEntry,
  type AuditAction,
} from "@/lib/admin-audit-log";

const selectCls =
  "rounded-full border border-input bg-card px-3 py-2 text-xs font-semibold outline-none focus:border-accent";

export default function AdminAuditLogPage() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("targetUserId") ?? undefined;

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<AuditAction | "">("");
  const [actorId, setActorId] = useState("");

  useEffect(() => {
    getAuditLogActors().then(setActors);
  }, []);

  useEffect(() => {
    setLoading(true);
    getAuditLog({
      action: action || undefined,
      actorId: actorId || undefined,
      targetUserId,
    }).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [action, actorId, targetUserId]);

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader
        title="Journal d&apos;audit"
        subtitle={targetUserId ? "Actions concernant ce compte." : "Actions sensibles de l'administration."}
      />

      <div className="flex flex-wrap gap-2 px-5 pb-4">
        <select value={action} onChange={(e) => setAction(e.target.value as AuditAction | "")} className={selectCls}>
          <option value="">Tous types d&apos;action</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={selectCls}>
          <option value="">Tous les acteurs</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-secondary">
            <Icon name="history" size={28} className="text-muted-foreground" />
          </span>
          <p className="text-sm font-bold">Aucune entrée</p>
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {items.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{AUDIT_ACTION_LABELS[entry.action]}</p>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {new Date(entry.occurredAt).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Par {entry.actorName}
                {entry.targetUserName && <> · concerne {entry.targetUserName}</>}
              </p>
              {entry.detail && <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
