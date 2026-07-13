import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Price } from "@/components/mboacoin/price";
import { priceSuffixFor } from "@/lib/price-period";
import { createClient } from "@/lib/supabase/server";
import { loginUrl } from "@/lib/auth-redirect";

interface ActiveLeaseRow {
  id: string;
  rent_amount: number;
  payment_period: string;
  listing: { title: string; image_url: string | null } | { title: string; image_url: string | null }[] | null;
  landlord: { full_name: string | null } | { full_name: string | null }[] | null;
}

export default async function MyLeasePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginUrl("/my-lease"));

  const { data } = await supabase
    .from("leases")
    .select("id, rent_amount, payment_period, listing:listings(title, image_url), landlord:profiles!landlord_id(full_name)")
    .eq("tenant_id", user.id)
    .eq("status", "actif")
    .order("created_at", { ascending: false });

  const leases = (data ?? []) as ActiveLeaseRow[];

  if (leases.length === 0) {
    return (
      <div className="flex flex-col">
        <ScreenHeader title="Ma location" />
        <p className="px-5 py-16 text-center text-sm font-bold text-muted-foreground">
          Aucune location active pour le moment
        </p>
      </div>
    );
  }

  if (leases.length === 1) {
    redirect(`/my-lease/${leases[0].id}`);
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Ma location" subtitle="Vous avez plusieurs locations actives." />
      <div className="space-y-3 px-5 pb-8">
        {leases.map((l) => {
          const listing = Array.isArray(l.listing) ? l.listing[0] : l.listing;
          const landlord = Array.isArray(l.landlord) ? l.landlord[0] : l.landlord;
          return (
            <Link
              key={l.id}
              href={`/my-lease/${l.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <Image src={listing?.image_url ?? "/img/listings/demo-1.jpg"} alt="" fill className="object-cover" sizes="64px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{listing?.title ?? "Logement"}</p>
                <p className="text-xs text-muted-foreground">{landlord?.full_name ?? "Bailleur"}</p>
                <Price amount={l.rent_amount} suffix={priceSuffixFor(l.payment_period)} size="sm" className="mt-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
