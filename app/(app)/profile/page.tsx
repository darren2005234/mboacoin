import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { signOut } from "./actions";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { TrustSealBadge } from "@/components/mboacoin/trust-seal";
import { Icon } from "@/components/mboacoin/icon";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Mon profil" />

      <div className="flex flex-col items-center gap-3 px-5 pb-6 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-secondary">
          <Icon name="person" size={40} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-extrabold">{profile.fullName ?? "Sans nom"}</p>
          <p className="text-sm text-muted-foreground">{profile.phone}</p>
        </div>
        <TrustSealBadge label="Non vérifié" tone="pending" />
      </div>

      <div className="space-y-2 px-5">
        <MenuRow icon="person" label="Modifier mon profil" />
        <MenuRow icon="verified_user" label="Vérifier mon identité" />
        <MenuRow icon="apartment" label="Mes annonces" />
        <MenuRow icon="settings" label="Paramètres" />
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

function MenuRow({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3.5 text-[15px] font-semibold">
      <span className="flex items-center gap-3">
        <Icon name={icon} size={22} className="text-muted-foreground" filled={false} />
        {label}
      </span>
      <Icon name="chevron_right" size={20} className="text-muted-foreground" />
    </button>
  );
}