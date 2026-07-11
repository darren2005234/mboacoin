import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { signOut } from "./actions";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EditableAvatar } from "@/components/mboacoin/editable-avatar";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { count: activeLeaseCount } = await supabase
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.id)
    .eq("status", "actif");
  const hasActiveLease = (activeLeaseCount ?? 0) > 0;

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
        {profile.verification === "verifie" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-seal-bg px-3 py-1 text-xs font-bold text-seal-text">
            <Icon name="verified" size={14} /> Vérifié
          </span>
        ) : profile.verification === "en_attente" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pending-bg px-3 py-1 text-xs font-bold text-pending-text">
            <Icon name="hourglass_top" size={14} /> Vérification en cours
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
            <Icon name="gpp_maybe" size={14} /> Non vérifié
          </span>
        )}
      </div>

      <div className="space-y-2 px-5">
        <MenuRow icon="edit" label="Modifier mon profil" href="/profile/edit" />
        <MenuRow icon="verified_user" label="Vérifier mon identité" href="/profile/verification" />
        <MenuRow icon="apartment" label="Mes annonces" href="/my-listings" />
        <MenuRow icon="key" label="Mes baux" href="/my-leases" />
        {hasActiveLease && <MenuRow icon="home" label="Ma location" href="/my-lease" />}
        {profile.accountType === "residence" && (
          <MenuRow icon="location_city" label="Mes résidences" href="/my-residences" />
        )}
        {(profile.accountType === "agence" || profile.accountType === "residence") && (
          <MenuRow icon="query_stats" label="Statistiques" href="/analytics" />
        )}
        <MenuRow icon="settings" label="Paramètres" />
        <MenuRow icon="description" label="Conditions d'utilisation" href="/legal/conditions" />
        <MenuRow icon="shield" label="Politique de confidentialité" href="/legal/confidentialite" />
        {profile.role === "admin" && (
          <MenuRow icon="admin_panel_settings" label="Administration" href="/admin" />
        )}
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