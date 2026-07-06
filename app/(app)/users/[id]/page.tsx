import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/public-profile";
import { Avatar } from "@/components/mboacoin/avatar";
import { ListingCard } from "@/components/mboacoin/listing-card";
import { TrustSeal } from "@/components/mboacoin/trust-seal";
import { BackButton } from "@/components/mboacoin/back-button";
import { ViewableAvatar } from "@/components/mboacoin/viewable-avatar";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const memberSince = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col">
      <div className="relative">
        <BackButton fallback="/explore" />
        <div className="flex flex-col items-center gap-3 px-5 pb-6 pt-16 text-center">
          <ViewableAvatar name={profile.fullName} src={profile.avatarUrl} size={88} />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-xl font-extrabold">{profile.fullName}</h1>
              {profile.verified && <TrustSeal size={18} />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile.verified ? "Bailleur vérifié" : "Membre"}
              {profile.city ? ` · ${profile.city}` : ""}
            </p>
            {memberSince && (
              <p className="text-xs text-muted-foreground">Membre depuis {memberSince}</p>
            )}
            {profile.bio && (
              <p className="mt-3 px-2 text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-border px-5 py-5">
        <h2 className="text-sm font-bold">
          Annonces en ligne ({profile.listings.length})
        </h2>
        {profile.listings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune annonce en ligne pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}