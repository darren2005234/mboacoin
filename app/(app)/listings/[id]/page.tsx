import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getListingById } from "@/lib/listings";
import { ListingLocationMapLazy } from "@/components/mboacoin/listing-location-map-lazy";
import { formatFCFA } from "@/lib/utils";
import { Price } from "@/components/mboacoin/price";
import { TrustSeal } from "@/components/mboacoin/trust-seal";
import { Gallery } from "@/components/mboacoin/gallery";
import { ExpandableText } from "@/components/mboacoin/expandable-text";
import { ListingFeatures } from "@/components/mboacoin/listing-features";
import { ContactButton } from "@/components/mboacoin/contact-button";
import { RequestVisitButton } from "@/components/mboacoin/request-visit-button";
import { BackButton } from "@/components/mboacoin/back-button";
import { Avatar } from "@/components/mboacoin/avatar";
import { ReportDialog } from "@/components/mboacoin/report-dialog";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/mboacoin/icon";
import { countFavoritesServer } from "@/lib/favorites-server";
import { ListingActions } from "@/components/mboacoin/listing-actions";
import { getMyFavoriteIdsServer } from "@/lib/favorites-server";
import { ViewTracker } from "@/components/mboacoin/view-tracker";
import { unavailableListingSentence } from "@/lib/listing-status";

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
  let isTenant = false;
  if (user && !isOwner) {
    const { count } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .eq("tenant_id", user.id)
      .in("status", ["en_attente_confirmation", "actif"]);
    isTenant = (count ?? 0) > 0;
  }
  const favoritesCount = await countFavoritesServer(listing.id);
  const isFavorited = favoriteIds.has(listing.id);

  // latitude/longitude sont des colonnes révoquées en select direct (voir
  // 20260717170000_listing_geolocation.sql) : get_listing_location applique
  // la règle de révélation (exact / approximatif) côté serveur.
  const { data: locationRowRaw } = await supabase
    .rpc("get_listing_location", { p_listing_id: listing.id })
    .maybeSingle();
  const locationRow = locationRowRaw as {
    is_exact: boolean; latitude: number; longitude: number; radius_meters: number | null;
  } | null;
  if (!listing.available && !isTenant) {
    const isSuspended = listing.status === "suspendue";
    if (isOwner) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-pending-bg">
            <Icon name={isSuspended ? "gpp_maybe" : "task_alt"} size={32} className="text-pending-text" filled={false} />
          </div>
          <h1 className="text-lg font-extrabold">
            {isSuspended ? "Annonce suspendue" : "Annonce marquée comme louée"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuspended
              ? "Cette annonce a été suspendue par la modération et n'est plus visible publiquement. Contactez le support pour plus d'informations."
              : "Cette annonce n'est plus visible publiquement. Vous pouvez la remettre en ligne ou la gérer à tout moment."}
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
        <p className="text-sm text-muted-foreground">{unavailableListingSentence(listing.status)}</p>
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
          {locationRow && (
            <ListingLocationMapLazy
              latitude={locationRow.latitude}
              longitude={locationRow.longitude}
              isExact={locationRow.is_exact}
              radiusMeters={locationRow.radius_meters}
            />
          )}
          <div className="pt-1">
            <Price amount={listing.price} suffix={listing.priceSuffix} size="lg" />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon name="confirmation_number" size={16} className="text-accent" />
            {listing.visitFeeAmount > 0 ? (
              <span>Frais de visite : {formatFCFA(listing.visitFeeAmount)} FCFA</span>
            ) : (
              <span>Visite gratuite</span>
            )}
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
        {(listing.advanceAmount || listing.depositAmount) && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-secondary p-3 text-center">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Avance</div>
              <div className="font-mono text-base font-bold">
                {listing.advanceAmount != null ? `${formatFCFA(listing.advanceAmount)} FCFA` : "—"}
              </div>
            </div>
            <div className="border-l border-border">
              <div className="text-xs font-medium text-muted-foreground">Caution</div>
              <div className="font-mono text-base font-bold">
                {listing.depositAmount != null ? `${formatFCFA(listing.depositAmount)} FCFA` : "—"}
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
        {listing.residenceId && listing.residenceName && (
          <Link
            href={`/residences/${listing.residenceId}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
              <Image
                src={listing.residenceImage ?? "/img/listings/demo-1.jpg"}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Ce logement fait partie de la Résidence {listing.residenceName}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{listing.residenceLocation}</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-muted-foreground" />
          </Link>
        )}
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

      {!isTenant && !isOwner && (
        <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card p-4">
          <ContactButton listingId={listing.id} ownerId={listing.ownerId} />
          <RequestVisitButton listingId={listing.id} feeAmount={listing.visitFeeAmount} />
        </div>
      )}
    </div>
  );
}