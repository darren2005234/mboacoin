import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";

export default function SplashPage() {
  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:shadow-soft">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="grid size-20 place-items-center rounded-3xl bg-white/10">
            <Icon name="home" size={40} />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">MboaCoin</h1>
          <p className="max-w-[16rem] text-sm text-primary-foreground/70">
            Le logement de confiance, au Cameroun
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/welcome"
            className="flex items-center justify-center rounded-xl bg-primary-foreground py-4 text-base font-bold text-primary"
          >
            Commencer
          </Link>
          <div className="flex items-center justify-center gap-1.5 text-xs text-primary-foreground/60">
            <Icon name="verified" size={16} /> Annonces vérifiées
          </div>
        </div>
      </div>
    </main>
  );
}