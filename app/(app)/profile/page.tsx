import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { signOut } from "./actions";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EditableAvatar } from "@/components/mboacoin/editable-avatar";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mon profil" />

      <div className="flex flex-col items-center gap-3 px-5 pb-6 text-center">
        <EditableAvatar
          name={profile.fullName ?? "Utilisateur"}
          initialSrc={profile.avatarUrl}
          size={80}
        />
        <div>
          <p className="text-lg font-extrabold">{profile.fullName ?? "Sans nom"}</p>
          <p className="text-sm text-muted-foreground">{profile.phone}</p>
        </div>
        <TrustSealBadge label="Non vérifié" tone="pending" />
      </div>

      <div className="space-y-2 px-5">
        <MenuRow icon="person" label="Modifier mon profil" />
        <MenuRow icon="verified_user" label="Vérifier mon identité" />
        <MenuRow icon="apartment" label="Mes annonces" href="/my-listings" />
        <MenuRow icon="settings" label="Paramètres" />
        <MenuRow icon="description" label="Conditions d'utilisation" href="/legal/conditions" />
        <MenuRow icon="shield" label="Politique de confidentialité" href="/legal/confidentialite" />
      </div>

      <div className="p-5">
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full text-destructive">
            <Icon name="logout" size={20} /> Se déconnecter
          </Button>
        </form>
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex items-center gap-3">
        <Icon name={icon} size={22} className="text-muted-foreground" filled={false} />
        {label}
      </span>
      <Icon name="chevron_right" size={20} className="text-muted-foreground" />
    </>
  );

  const className =
    "flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3.5 text-[15px] font-semibold";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <button className={className}>{content}</button>;
}