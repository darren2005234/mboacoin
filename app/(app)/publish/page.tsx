import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { ScreenHeader } from "@/components/mboacoin/screen-header";
import { Icon } from "@/components/mboacoin/icon";
import { PublishForm } from "@/components/mboacoin/publish-form";
import { loginUrl } from "@/lib/auth-redirect";

export default async function PublishPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect(loginUrl("/publish"));

  const needsVerification = profile.accountType === "agence" || profile.accountType === "residence";
  if (needsVerification && profile.verification !== "verifie") {
    return (
      <div className="flex flex-col">
        <ScreenHeader title="Publier une annonce" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-pending-bg">
            <Icon name="verified_user" size={30} className="text-pending-text" />
          </span>
          <h2 className="text-base font-bold">Vérification requise</h2>
          <p className="text-sm text-muted-foreground">
            Votre compte doit être vérifié pour publier une annonce.
          </p>
          <Link
            href="/profile/verification"
            className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-btn"
          >
            Vérifier mon compte
          </Link>
        </div>
      </div>
    );
  }

  return <PublishForm accountType={profile.accountType} verified={profile.verification === "verifie"} />;
}
