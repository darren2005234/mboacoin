"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import { getUserAdminDetail, suspendAccount, unsuspendAccount, type UserAdminDetail } from "@/lib/admin-users";
import { getReportsReceived, type ReceivedReport } from "@/lib/admin-reports";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  personne_physique: "Particulier",
  agence: "Agence",
  residence: "Résidence",
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<UserAdminDetail | null>(null);
  const [receivedReports, setReceivedReports] = useState<ReceivedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [detail, reports] = await Promise.all([getUserAdminDetail(id), getReportsReceived(id)]);
    setProfile(detail);
    setReceivedReports(reports);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function confirmSuspend() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    const result = await suspendAccount(id, reason.trim());
    if (result.error) setError(result.error);
    setSuspending(false);
    setReason("");
    await refresh();
    setBusy(false);
  }

  async function lift() {
    setBusy(true);
    setError(null);
    const result = await unsuspendAccount(id);
    if (result.error) setError(result.error);
    await refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col pb-8">
      <Link href="/admin" aria-label="Retour" className="absolute left-4 top-4 z-10 text-muted-foreground">
        <ArrowLeft className="size-5" />
      </Link>
      <ScreenHeader title="Fiche utilisateur" subtitle="Vue administrateur." />

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : !profile ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Utilisateur introuvable.</p>
      ) : (
        <div className="space-y-4 px-5">
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">{profile.fullName}</p>
              {profile.suspendedAt && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                  Suspendu
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {ACCOUNT_TYPE_LABEL[profile.accountType] ?? profile.accountType}
              {profile.city ? ` · ${profile.city}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">Vérification : {profile.verification}</p>
            <p className="text-xs text-muted-foreground">
              Membre depuis {new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
            <a
              href={`/users/${profile.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-accent underline"
            >
              <Icon name="open_in_new" size={14} /> Voir le profil public
            </a>
          </div>

          {profile.suspendedAt ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-bold text-destructive">Compte suspendu</p>
              <p className="text-xs text-muted-foreground">
                Depuis le {new Date(profile.suspendedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              {profile.suspensionReason && (
                <p className="rounded-xl bg-secondary/50 p-3 text-xs">
                  <span className="font-bold">Motif interne : </span>
                  {profile.suspensionReason}
                </p>
              )}
              <Button size="sm" onClick={lift} disabled={busy}>
                <Icon name="check_circle" size={16} /> Lever la suspension
              </Button>
            </div>
          ) : suspending ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Motif interne (jamais affiché à l'utilisateur)..."
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSuspending(false); setReason(""); }}>
                  Annuler
                </Button>
                <Button size="sm" className="flex-1" onClick={confirmSuspend} disabled={busy || !reason.trim()}>
                  Confirmer la suspension
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="text-destructive" onClick={() => setSuspending(true)} disabled={busy}>
              <Icon name="block" size={16} /> Suspendre ce compte
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">
              Signalements reçus {receivedReports.length > 0 && `(${receivedReports.length})`}
            </p>
            {receivedReports.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun signalement reçu.</p>
            ) : (
              <div className="space-y-2">
                {receivedReports.map((r) => (
                  <div key={r.id} className="rounded-xl bg-secondary/50 p-3">
                    <p className="text-xs font-bold">{r.reason}</p>
                    {r.details && <p className="mt-0.5 text-xs text-muted-foreground">{r.details}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Signalé par {r.reporterName} le{" "}
                      {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {r.status === "ouvert" ? "Non traité" : r.status === "traite" ? "Traité" : "Rejeté"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
