"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { listSuspendedAccounts, unsuspendAccount, type SuspendedAccount } from "@/lib/admin-users";

export default function AdminSuspendedUsersPage() {
  const [items, setItems] = useState<SuspendedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setItems(await listSuspendedAccounts());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function lift(item: SuspendedAccount) {
    setBusy(item.id);
    await unsuspendAccount(item.id);
    await refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Comptes suspendus" subtitle="Comptes actuellement bloqués par un administrateur." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-bg">
            <Icon name="check_circle" size={28} className="text-ok-text" />
          </span>
          <p className="text-sm font-bold">Aucun compte suspendu</p>
        </div>
      ) : (
        <div className="space-y-4 px-5">
          {items.map((item) => (
            <div key={item.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{item.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Suspendu depuis le{" "}
                    {new Date(item.suspendedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <Link
                  href={`/admin/users/${item.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent underline"
                >
                  Voir la fiche
                </Link>
              </div>

              {item.suspensionReason && (
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-bold">Motif interne : </span>
                    {item.suspensionReason}
                  </p>
                </div>
              )}

              <Button size="sm" onClick={() => lift(item)} disabled={busy === item.id}>
                <Icon name="check_circle" size={16} /> Lever la suspension
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
