import Link from "next/link";
import { SlidersHorizontal, Search } from "lucide-react";
import { ListingCard } from "@/components/mboacoin/listing-card";
import { Wordmark } from "@/components/mboacoin/wordmark";
import { Icon } from "@/components/mboacoin/icon";
import { getPublishedListings } from "@/lib/listings";
import { getCurrentProfile } from "@/lib/profile";

const CATEGORIES = ["Studios", "Appartements", "Villas", "Chambres", "Meublés"];

export default async function ExplorePage() {
  const listings = await getPublishedListings();
  const profile = await getCurrentProfile();

  return (
    <div className="flex flex-col">
      {/* En-tête : personnalisé si connecté, public sinon */}
      {profile ? (
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Bonjour,</p>
            <p className="text-lg font-extrabold">{profile.fullName ?? profile.phone}</p>
          </div>
          <button
            aria-label="Notifications"
            className="grid size-11 place-items-center rounded-full bg-secondary text-foreground"
          >
            <Icon name="notifications" size={22} />
          </button>
        </header>
      ) : (
        <header className="space-y-4 px-5 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <Wordmark />
            <Link
              href="/login"
              className="rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-primary"
            >
              Connexion
            </Link>
          </div>
          <h1 className="screen-title">Un logement de confiance, sans mauvaise surprise.</h1>
          <p className="screen-subtitle">
            Explorez librement. Créez un compte pour contacter, visiter et réserver en sécurité.
          </p>
        </header>
      )}

      {/* Recherche */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
          <Search className="size-5 text-muted-foreground" strokeWidth={2.25} />
          <input
            placeholder="Ville, quartier, budget..."
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <button aria-label="Filtres" className="text-primary">
            <SlidersHorizontal className="size-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Catégories */}
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 pb-5">
        {CATEGORIES.map((c, i) => (
          <button
            key={c}
            className={
              i === 0
                ? "whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-btn"
                : "whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-4 px-5 pb-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Annonces récentes ({listings.length})</p>
          <span className="text-sm font-semibold text-primary">Voir tout</span>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-bold">Aucune annonce pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground">Les annonces publiées apparaîtront ici.</p>
          </div>
        ) : (
          listings.map((l) => <ListingCard key={l.id} listing={l} />)
        )}
      </div>
    </div>
  );
}