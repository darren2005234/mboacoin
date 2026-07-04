import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, CalendarDays } from "lucide-react";
import { getListingById } from "@/lib/listings";
import { Price } from "@/components/mboacoin/price";
import { TrustSeal } from "@/components/mboacoin/trust-seal";
import { Button } from "@/components/ui/button";
import { Gallery } from "@/components/mboacoin/gallery";
import { ExpandableText } from "@/components/mboacoin/expandable-text";
import { ListingFeatures } from "@/components/mboacoin/listing-features";
import { ContactButton } from "@/components/mboacoin/contact-button";
import { BackButton } from "@/components/mboacoin/back-button";

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
      <div className="relative shrink-0">
        <Gallery images={listing.images} alt={listing.title} />
        <BackButton />
      </div>

      <div className="flex-1 space-y-6 p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold leading-tight">{listing.title}</h1>
          <p className="text-sm font-medium text-muted-foreground">{listing.location}</p>
          <div className="pt-1">
            <Price amount={listing.price} suffix={listing.priceSuffix} size="lg" />
          </div>
        </div>

        {/* Conditions financières : affichées seulement si renseignées */}
        {(listing.advanceMonths || listing.depositMonths) && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-secondary p-3 text-center">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Avance</div>
              <div className="font-mono text-base font-bold">
                {listing.advanceMonths ?? "—"} mois
              </div>
            </div>
            <div className="border-l border-border">
              <div className="text-xs font-medium text-muted-foreground">Caution</div>
              <div className="font-mono text-base font-bold">
                {listing.depositMonths ?? "—"} mois
              </div>
            </div>
          </div>
        )}

        {/* Bailleur : vrai nom, badge seulement si vérifié */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="grid size-11 place-items-center rounded-full bg-secondary text-sm font-bold text-muted-foreground">
            {listing.ownerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              {listing.ownerName}
              {listing.verified && <TrustSeal size={16} />}
            </div>
            <div className="text-xs text-muted-foreground">
              {listing.verified ? "Bailleur vérifié" : "Bailleur"}
            </div>
          </div>
        </div>
        <ListingFeatures
          features={{
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            furnishing: listing.furnishing,
            water: listing.water,
            electricity: listing.electricity,
            amenities: listing.amenities,
          }}
        />
        {/* Description : affichée seulement si renseignée */}
        {listing.description && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold">Description</h2>
            <ExpandableText text={listing.description} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card p-4">
        <ContactButton listingId={listing.id} ownerId={listing.ownerId} />
        <Button size="lg" className="flex-1">
          <CalendarDays className="size-5" /> Visiter
        </Button>
      </div>
    </div>
  );
}