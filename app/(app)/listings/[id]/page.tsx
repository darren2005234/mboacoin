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
import { Avatar } from "@/components/mboacoin/avatar";
import { ReportDialog } from "@/components/mboacoin/report-dialog";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/mboacoin/icon";
import { countFavoritesServer } from "@/lib/favorites-server";
import { ListingActions } from "@/components/mboacoin/listing-actions";
import { getMyFavoriteIdsServer } from "@/lib/favorites-server";
import { ViewTracker } from "@/components/mboacoin/view-tracker";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);
  const favoriteIds = await getMyFavoriteIdsServer();
  
  const supabase = await createClient();
 
    const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!listing) notFound();
  const isOwner = user?.id === listing.ownerId;
  const favoritesCount = await countFavoritesServer(listing.id);
  const isFavorited = favoriteIds.has(listing.id);
  if (!listing.available) {
    if (isOwner) {
  
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-pending-bg">
            <Icon name="task_alt" size={32} className="text-pending-text" filled={false} />
          </div>
          <h1 className="text-lg font-extrabold">Annonce marquée comme louée</h1>
          <p className="text-sm text-muted-foreground">
            Cette annonce n&apos;est plus visible publiquement. Vous pouvez la remettre en ligne ou la gérer à tout moment.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href="/my-listings"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
            >
              Gérer mes annonces
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-secondary">
          <Icon name="do_not_disturb_on" size={32} className="text-muted-foreground" filled={false} />
        </div>
        <h1 className="text-lg font-extrabold">Annonce non disponible</h1>
        <p className="text-sm text-muted-foreground">
          Cette annonce a été louée ou retirée par son propriétaire.
        </p>
        <Link
          href="/explore"
          className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
        >
          Voir d&apos;autres annonces
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ViewTracker listingId={listing.id} />
      <div className="relative shrink-0">
        <Gallery images={listing.images} alt={listing.title} />
        <BackButton />
        <ListingActions
          listingId={listing.id}
          title={listing.title}
          initialFavorited={isFavorited}
          favoritesCount={favoritesCount}
        />

      </div>

      <div className="flex-1 space-y-6 p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold leading-tight">{listing.title}</h1>
          {listing.propertyVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-seal-bg px-3 py-1 text-xs font-bold text-seal-text">
              <TrustSeal size={14} /> Logement vérifié
            </span>
        )}
          <p className="text-sm font-medium text-muted-foreground">{listing.location}</p>
          {listing.addressDescription && (
          <div className="flex items-start gap-2 text-sm text-foreground/80">
            <Icon name="location_on" size={18} className="mt-0.5 shrink-0 text-accent" />
            <span>{listing.addressDescription}</span>
          </div>
          )}
          <div className="pt-1">
            <Price amount={listing.price} suffix={listing.priceSuffix} size="lg" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Icon name="event_available" size={18} className="text-accent" />
          <span className="font-medium">
            {listing.availableFrom
              ? `Disponible à partir du ${new Date(listing.availableFrom).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
              : "Disponible immédiatement"}
          </span>
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
        <Link
          href={`/users/${listing.ownerId}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
        >  
          <div>
            <Avatar name={listing.ownerName} src={listing.ownerAvatar} size={44} />
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
        </Link>
        <ListingFeatures
          features={{
            rooms: listing.rooms,
            area: listing.area,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            furnishing: listing.furnishing,
            water: listing.water,
            electricity: listing.electricity,
            amenities: listing.amenities,
          }}
          
        />
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {listing.floorNumber != null && (
            <span className="flex items-center gap-1.5">
              <Icon name="stairs" size={18} className="text-accent" />
              {listing.floorNumber === 0 ? "Rez-de-chaussée" : `${listing.floorNumber}e étage`}
            </span>
          )}
          {listing.carAccess && (
            <span className="flex items-center gap-1.5">
              <Icon name="directions_car" size={18} className="text-accent" /> Accès voiture
            </span>
          )}
        </div>
        {listing.floodZone && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <Icon name="warning" size={20} className="mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">Zone inondable</p>
              <p className="text-xs text-muted-foreground">
                Ce logement est situé en zone inondable selon le bailleur. Renseignez-vous sur les précautions en saison des pluies.
              </p>
            </div>
          </div>
        )}
        {/* Description : affichée seulement si renseignée */}
        {listing.description && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold">Description</h2>
            <ExpandableText text={listing.description} />
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Référence : {listing.reference}
        </p>
        {!isOwner && (
          <div className="flex justify-center pt-2">
            <ReportDialog targetType="listing" targetId={listing.id} label="Signaler cette annonce" />
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