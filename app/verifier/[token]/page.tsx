import { Logo } from "@/components/mboacoin/logo";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Icon } from "@/components/mboacoin/icon";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PublicReceipt {
  receipt_number: string;
  period: string;
  amount: number;
  paid_at: string;
  method: string;
  issued_at: string;
  tenant_name: string | null;
  landlord_name: string | null;
  batch_month_count: number | null;
}

function formatFCFA(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatPeriodLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `Loyer du mois de ${label}`;
}

async function getPublicReceipt(token: string): Promise<PublicReceipt | null> {
  if (!UUID_RE.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_receipt", { p_token: token }).maybeSingle();
  return (data as PublicReceipt | null) ?? null;
}

export default async function VerifierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await getPublicReceipt(token);

  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={48} />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-foreground">Mboa</span>
            <span className="text-primary">Coin</span>
          </span>
        </div>

        {receipt ? (
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <TrustSealBadge label="Quittance authentique" />
                <p className="text-sm text-muted-foreground">
                  Émise par MboaCoin le {formatDate(receipt.issued_at)}
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <p className="field-label">Numéro de quittance</p>
                  <p className="text-base font-bold">{receipt.receipt_number}</p>
                </div>
                <div>
                  <p className="field-label">Période couverte</p>
                  <p className="text-base font-bold">{formatPeriodLabel(receipt.period)}</p>
                  {receipt.batch_month_count ? (
                    <p className="text-xs text-muted-foreground">
                      Fait partie d&apos;un versement de {receipt.batch_month_count} mois.
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="field-label">Locataire</p>
                    <p className="text-base font-bold">{receipt.tenant_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="field-label">Bailleur</p>
                    <p className="text-base font-bold">{receipt.landlord_name ?? "—"}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="field-label">Montant payé</p>
                  <p className="text-xl font-bold">{formatFCFA(receipt.amount)} F CFA</p>
                </div>
                <div>
                  <p className="field-label">Date de paiement</p>
                  <p className="text-base font-bold">{formatDate(receipt.paid_at)}</p>
                </div>
              </div>

              <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                {receipt.method === "mobile_money"
                  ? "Ce paiement a transité par MboaCoin (mobile money) : la plateforme en garantit l'exécution."
                  : "Ce document atteste d'un paiement déclaré par le bailleur. Tant que ce paiement ne transite pas par la plateforme MboaCoin, celle-ci ne peut pas en garantir la véracité."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <Icon name="cancel" size={26} />
              </span>
              <p className="text-base font-bold">Ce document n&apos;a pas été émis par MboaCoin</p>
              <p className="text-sm text-muted-foreground">
                Aucune quittance ne correspond à ce lien de vérification. Ne vous fiez pas au document
                présenté.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
