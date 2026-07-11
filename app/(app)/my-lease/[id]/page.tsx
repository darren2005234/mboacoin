import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Avatar } from "@/components/mboacoin/avatar";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Price } from "@/components/mboacoin/price";
import { Icon } from "@/components/mboacoin/icon";
import { priceSuffixFor } from "@/lib/price-period";
import { nextPaymentDueDate } from "@/lib/lease-schedule";
import { createClient } from "@/lib/supabase/server";

interface LeaseDetailRow {
  id: string;
  listing_id: string;
  landlord_id: string;
  start_date: string;
  duration_months: number | null;
  end_date: string | null;
  rent_amount: number;
  deposit_amount: number | null;
  advance_amount: number | null;
  payment_day: number | null;
  payment_period: string;
  listing: { title: string; image_url: string | null; city: string; neighborhood: string | null } | { title: string; image_url: string | null; city: string; neighborhood: string | null }[] | null;
  landlord: { full_name: string | null; avatar_url: string | null; verification: string } | { full_name: string | null; avatar_url: string | null; verification: string }[] | null;
}

export default async function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("leases")
    .select(
      "id, listing_id, landlord_id, start_date, duration_months, end_date, rent_amount, deposit_amount, advance_amount, payment_day, payment_period, listing:listings(title, image_url, city, neighborhood), landlord:profiles!landlord_id(full_name, avatar_url, verification)"
    )
    .eq("id", id)
    .eq("tenant_id", user.id)
    .eq("status", "actif")
    .maybeSingle();

  const row = data as LeaseDetailRow | null;
  if (!row) redirect("/my-lease");

  const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
  const landlord = Array.isArray(row.landlord) ? row.landlord[0] : row.landlord;
  const dueDate = nextPaymentDueDate(row.start_date, row.payment_day, row.payment_period);

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader title="Ma location" />

      <div className="space-y-4 px-5">
        {/* Logement */}
        <Link href={`/listings/${row.listing_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            <Image src={listing?.image_url ?? "/img/listings/demo-1.jpg"} alt="" fill className="object-cover" sizes="64px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-bold">{listing?.title ?? "Logement"}</p>
            <p className="text-xs text-muted-foreground">
              {[listing?.neighborhood, listing?.city].filter(Boolean).join(", ")}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-accent">Voir la fiche</p>
          </div>
        </Link>

        {/* Bailleur */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <Avatar name={landlord?.full_name ?? "Bailleur"} src={landlord?.avatar_url} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{landlord?.full_name ?? "Bailleur"}</p>
            {landlord?.verification === "verifie" && <TrustSealBadge label="Bailleur vérifié" className="mt-0.5" />}
          </div>
        </div>

        {/* Conditions du bail */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-bold">Conditions du bail</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="Début" value={new Date(row.start_date).toLocaleDateString("fr-FR")} />
            <Info
              label="Durée"
              value={row.duration_months ? `${row.duration_months} mois` : "Indéterminée"}
            />
            {row.end_date && <Info label="Fin prévue" value={new Date(row.end_date).toLocaleDateString("fr-FR")} />}
            <Info label="Loyer" value={<Price amount={row.rent_amount} suffix={priceSuffixFor(row.payment_period)} size="sm" />} />
            {row.deposit_amount ? <Info label="Caution" value={<Price amount={row.deposit_amount} size="sm" />} /> : null}
            {row.advance_amount ? <Info label="Avance" value={<Price amount={row.advance_amount} size="sm" />} /> : null}
            {row.payment_day ? <Info label="Jour de paiement" value={String(row.payment_day)} /> : null}
          </div>
        </div>

        {/* Prochaine échéance */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="icon-badge size-11">
            <Icon name="event" size={20} />
          </span>
          <div>
            <p className="text-sm font-bold">
              {dueDate ? `Prochain loyer dû le ${dueDate.toLocaleDateString("fr-FR")}` : "Facturation quotidienne"}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.payment_period === "journalier" ? "Périodicité journalière" : "Périodicité mensuelle"}
            </p>
          </div>
        </div>

        {/* Les paiements, quittances (Bail-3) et demandes d'intervention (Bail-4)
            s'ajouteront ici comme cartes supplémentaires. */}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
