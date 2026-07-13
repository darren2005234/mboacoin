"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { Avatar } from "@/components/mboacoin/avatar";
import { TrustSeal } from "@/components/mboacoin/trust-seal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/mboacoin/otp-input";
import { VisitStatusBadge } from "@/components/mboacoin/visit-status-badge";
import { formatFCFA } from "@/lib/utils";
import {
  getVisit,
  acceptSlot,
  proposeCounterSlots,
  refuseVisit,
  cancelVisit,
  getVisitCode,
  confirmVisitWithCode,
  reportNoShow,
  canCancelVisit,
  formatVisitDateTime,
  type Visit,
} from "@/lib/visits";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useRequireAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tenantCode, setTenantCode] = useState<string | null>(null);
  const [landlordCodeInput, setLandlordCodeInput] = useState("");
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);

  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterSlots, setCounterSlots] = useState<string[]>(["", ""]);

  async function refresh() {
    const v = await getVisit(id);
    if (!v) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setVisit(v);
    if (v.role === "locataire" && (v.status === "confirmee" || v.status === "effectuee")) {
      setTenantCode(await getVisitCode(v.id));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  async function handleAcceptSlot(slotAt: string) {
    setError(null);
    setBusy("accept");
    const result = await acceptSlot(id, slotAt);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  async function handleRefuse() {
    if (!confirm("Refuser cette demande de visite ?")) return;
    setError(null);
    setBusy("refuse");
    const result = await refuseVisit(id);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  async function handleCancel() {
    if (!confirm("Annuler cette visite ?")) return;
    setError(null);
    setBusy("cancel");
    const result = await cancelVisit(id);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  function updateCounterSlot(index: number, value: string) {
    setCounterSlots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  async function submitCounterSlots() {
    setError(null);
    const filled = counterSlots.filter(Boolean);
    if (filled.length < 2) {
      setError("Proposez au moins 2 créneaux.");
      return;
    }
    const dates = filled.map((s) => new Date(s));
    if (dates.some((d) => Number.isNaN(d.getTime()) || d.getTime() <= Date.now())) {
      setError("Les créneaux doivent être des dates valides, dans le futur.");
      return;
    }
    setBusy("counter");
    const result = await proposeCounterSlots(id, dates);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowCounterForm(false);
    refresh();
  }

  async function submitCode(code?: string) {
    setCodeFeedback(null);
    setBusy("code");
    const result = await confirmVisitWithCode(id, code ?? landlordCodeInput);
    setBusy(null);
    if (result.error) {
      setCodeFeedback(result.error);
      return;
    }
    if (!result.success) {
      setCodeFeedback("Code incorrect. Réessayez.");
      return;
    }
    setLandlordCodeInput("");
    refresh();
  }

  async function handleNoShow() {
    if (!confirm("Signaler que le locataire ne s'est pas présenté ?")) return;
    setError(null);
    setBusy("noshow");
    const result = await reportNoShow(id);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  if (!ready || loading) {
    return <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</p>;
  }

  if (notFound || !visit) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm font-bold">Visite introuvable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette visite n&apos;existe pas ou ne vous concerne pas.
        </p>
      </div>
    );
  }

  const isLandlord = visit.role === "bailleur";
  const isTenant = visit.role === "locataire";
  const landlordCounterSlots = visit.slots.filter((s) => s.proposedBy === visit.landlordId);
  const tenantSlots = visit.slots.filter((s) => s.proposedBy === visit.tenantId);
  const pastScheduled = visit.scheduledAt ? new Date(visit.scheduledAt).getTime() <= new Date().getTime() : false;

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Détail de la visite" />

      <div className="space-y-5 px-5">
        <Link
          href={`/listings/${visit.listingId}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold">{visit.listingTitle}</p>
            <p className="text-xs text-muted-foreground">{visit.listingLocation}</p>
          </div>
          <Icon name="chevron_right" size={20} className="shrink-0 text-muted-foreground" />
        </Link>

        <div className="flex items-center justify-between">
          <VisitStatusBadge status={visit.status} />
          <span className="text-xs font-medium text-muted-foreground">
            {visit.feeAmount > 0 ? `Frais : ${formatFCFA(visit.feeAmount)} FCFA` : "Visite gratuite"}
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <Avatar name={visit.other.name ?? "Utilisateur"} src={visit.other.avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              {visit.other.name ?? "Utilisateur"}
              {visit.other.verified && <TrustSeal size={16} />}
            </div>
            <p className="text-xs text-muted-foreground">{isTenant ? "Bailleur" : "Locataire"}</p>
          </div>
          {visit.conversationId && (
            <Link
              href={`/messages/${visit.conversationId}`}
              className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
            >
              Discuter
            </Link>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {/* Demandée : créneaux proposés par le locataire */}
        {visit.status === "demandee" && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">Créneaux proposés</p>
            <div className="space-y-2">
              {tenantSlots.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                  <span className="text-sm font-medium">{formatVisitDateTime(s.slotAt)}</span>
                  {isLandlord && (
                    <button
                      onClick={() => handleAcceptSlot(s.slotAt)}
                      disabled={busy === "accept"}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      Accepter
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isLandlord && !showCounterForm && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCounterForm(true)}>
                  Proposer d&apos;autres créneaux
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive"
                  onClick={handleRefuse}
                  disabled={busy === "refuse"}
                >
                  Refuser
                </Button>
              </div>
            )}

            {isLandlord && showCounterForm && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-bold">Vos créneaux (2 ou 3)</p>
                {counterSlots.map((s, i) => (
                  <Input
                    key={i}
                    type="datetime-local"
                    value={s}
                    onChange={(e) => updateCounterSlot(i, e.target.value)}
                  />
                ))}
                {counterSlots.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setCounterSlots((prev) => [...prev, ""])}
                    className="text-xs font-bold text-accent"
                  >
                    + Ajouter un créneau
                  </button>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={submitCounterSlots} disabled={busy === "counter"}>
                    Envoyer
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCounterForm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {isTenant && (
              <>
                <p className="text-xs text-muted-foreground">En attente de réponse du bailleur.</p>
                <Button variant="outline" size="sm" className="w-full text-destructive" onClick={handleCancel} disabled={busy === "cancel"}>
                  Annuler ma demande
                </Button>
              </>
            )}
          </div>
        )}

        {/* Créneau proposé par le bailleur : le locataire accepte ou refuse */}
        {visit.status === "creneau_propose" && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-bold">Le bailleur propose d&apos;autres créneaux</p>
            <div className="space-y-2">
              {landlordCounterSlots.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                  <span className="text-sm font-medium">{formatVisitDateTime(s.slotAt)}</span>
                  {isTenant && (
                    <button
                      onClick={() => handleAcceptSlot(s.slotAt)}
                      disabled={busy === "accept"}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      Accepter
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isTenant && (
              <Button variant="outline" size="sm" className="w-full text-destructive" onClick={handleCancel} disabled={busy === "cancel"}>
                Refuser ces créneaux
              </Button>
            )}
            {isLandlord && (
              <p className="text-xs text-muted-foreground">En attente de réponse du locataire.</p>
            )}
          </div>
        )}

        {/* Confirmée : créneau retenu, code de confirmation */}
        {visit.status === "confirmee" && visit.scheduledAt && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2">
              <Icon name="event_available" size={20} className="text-accent" />
              <p className="text-sm font-bold">Visite confirmée le {formatVisitDateTime(visit.scheduledAt)}</p>
            </div>

            {isTenant && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Remettez ce code au bailleur le jour de la visite :
                </p>
                {tenantCode ? (
                  <div className="rounded-xl border-2 border-accent bg-brand-50 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.3em]">
                    {tenantCode}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Code indisponible.</p>
                )}
                {canCancelVisit(visit) ? (
                  <Button variant="outline" size="sm" className="w-full text-destructive" onClick={handleCancel} disabled={busy === "cancel"}>
                    Annuler la visite
                  </Button>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Annulation impossible à moins de 3h du créneau.
                  </p>
                )}
              </div>
            )}

            {isLandlord && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Saisissez le code remis par le locataire sur place :
                </p>
                <OtpInput value={landlordCodeInput} onChange={setLandlordCodeInput} onComplete={(code) => submitCode(code)} />
                {codeFeedback && <p className="text-center text-xs font-medium text-destructive">{codeFeedback}</p>}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => submitCode()}
                  disabled={busy === "code" || landlordCodeInput.length !== 6}
                >
                  Valider le code
                </Button>
                {pastScheduled && !visit.noShow && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive"
                    onClick={handleNoShow}
                    disabled={busy === "noshow"}
                  >
                    Signaler une absence (no-show)
                  </Button>
                )}
                {visit.noShow && (
                  <p className="text-center text-xs font-medium text-destructive">
                    Absence signalée pour cette visite.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* États terminaux */}
        {["effectuee", "annulee", "refusee", "expiree"].includes(visit.status) && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-center shadow-card">
            {visit.status === "effectuee" && (
              <p className="text-sm font-medium">
                Visite effectuée{visit.completedAt ? ` le ${formatVisitDateTime(visit.completedAt)}` : ""}.
              </p>
            )}
            {visit.status === "annulee" && (
              <p className="text-sm font-medium">
                Visite annulée{visit.cancelledAt ? ` le ${formatVisitDateTime(visit.cancelledAt)}` : ""}.
              </p>
            )}
            {visit.status === "refusee" && <p className="text-sm font-medium">Demande refusée par le bailleur.</p>}
            {visit.status === "expiree" && (
              <p className="text-sm font-medium">Visite expirée : aucun code saisi dans les 72h suivant le créneau.</p>
            )}
            {visit.noShow && (
              <p className="text-xs font-medium text-destructive">Une absence a été signalée pour cette visite.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
