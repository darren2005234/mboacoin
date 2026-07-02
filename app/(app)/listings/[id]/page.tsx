import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bolt, Car, MessageSquare, CalendarDays, Droplet } from "lucide-react";
import { getListingById } from "@/lib/listings";
import { Price } from "@/components/mboacoin/price";
import { TrustSeal } from "@/components/mboacoin/trust-seal";
import { Button } from "@/components/ui/button";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-56 shrink-0 bg-secondary">
        <Image src={listing.image} alt="" fill className="object-cover" sizes="448px" priority />
        <Link
          href="/explore"
          aria-label="Retour"
          className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-card/85 text-foreground backdrop-blur"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="absolute bottom-4 right-4 rounded-lg bg-foreground/70 px-2.5 py-1 text-[11px] font-medium text-background">
          1 / 6 photos
        </span>
      </div>

      <div className="flex-1 space-y-5 p-5">
        <div className="space-y-1">
          <h1 className="text-lg font-bold leading-tight">{listing.title}</h1>
          <p className="text-xs font-medium text-muted-foreground">{listing.location}</p>
          <div className="pt-1">
            <Price amount={listing.price} suffix={listing.priceSuffix} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-secondary p-3 text-center">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground">Avance</div>
            <div className="font-mono text-sm font-bold">3 mois</div>
          </div>
          <div className="border-l border-border">
            <div className="text-[11px] font-medium text-muted-foreground">Caution</div>
            <div className="font-mono text-sm font-bold">2 mois</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card">
          <div className="size-10 rounded-full bg-secondary" />
          <div>
            <div className="flex items-center gap-1 text-sm font-bold">
              Samuel N. {listing.verified && <TrustSeal size={14} />}
            </div>
            <div className="text-[11px] text-muted-foreground">Bailleur particulier</div>
          </div>
        </div>

        <div className="space-y-2.5">
          <h2 className="text-sm font-bold">Critères spécifiques</h2>
          <ul className="grid gap-2.5 text-xs font-medium text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Droplet className="size-4 text-accent" /> Eau : forage 24h/24
            </li>
            <li className="flex items-center gap-2.5">
              <Bolt className="size-4 text-accent" /> Compteur Eneo prépayé
            </li>
            <li className="flex items-center gap-2.5">
              <Car className="size-4 text-accent" /> Parking sécurisé
            </li>
          </ul>
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card p-4">
        <Button variant="outline" className="flex-1">
          <MessageSquare className="size-4" /> Chat
        </Button>
        <Button className="flex-1">
          <CalendarDays className="size-4" /> Visiter
        </Button>
      </div>
    </div>
  );
}