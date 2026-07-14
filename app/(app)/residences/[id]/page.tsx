import { notFound } from "next/navigation";
import { getPublicResidence } from "@/lib/public-residence";
import { ListingCard } from "@/components/mboacoin/listing-card";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { BackButton } from "@/components/mboacoin/back-button";
import { ResidenceHeroImage } from "@/components/mboacoin/residence-hero-image";
import { getMyFavoriteIdsServer } from "@/lib/favorites-server";

export default async function PublicResidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const residence = await getPublicResidence(id);
  if (!residence) notFound();
  const favoriteIds = await getMyFavoriteIdsServer();

  return (
    <div className="flex flex-col">
      <div className="relative h-56 w-full bg-secondary">
        <ResidenceHeroImage src={residence.imageUrl ?? "/img/listings/demo-1.jpg"} />
        <BackButton fallback="/explore" />
      </div>

      <div className="space-y-2 px-5 py-4 text-center">
        <h1 className="text-xl font-extrabold">{residence.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[residence.neighborhood, residence.city].filter(Boolean).join(", ")}
        </p>
        {residence.managerVerified && (
          <div className="flex justify-center">
            <TrustSealBadge label="Gestionnaire vérifié" />
          </div>
        )}
        {residence.description && (
          <p className="mx-auto max-w-md px-2 text-sm leading-relaxed text-foreground/80">
            {residence.description}
          </p>
        )}
      </div>

      <div className="space-y-4 border-t border-border px-5 py-5">
        <h2 className="text-sm font-bold">Logements disponibles ({residence.listings.length})</h2>
        {residence.listings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun logement disponible dans cette résidence pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {residence.listings.map((l) => (
              <ListingCard key={l.id} listing={l} initialFavorited={favoriteIds.has(l.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
