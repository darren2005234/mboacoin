import Link from "next/link";
import { Wordmark } from "@/components/mboacoin/wordmark";
import { Icon } from "@/components/mboacoin/icon";
import { getCurrentProfile } from "@/lib/profile";
import { SearchableListings } from "@/components/mboacoin/searchable-listings";

export default async function ExplorePage() {
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

      {/* Recherche + résultats (interactif) */}
      <SearchableListings userCity={profile?.city ?? null} />
    </div>
  );
}