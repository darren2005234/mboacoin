import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/mboacoin/icon";

const POINTS = [
  { icon: "verified", text: "Annonces et bailleurs vérifiés" },
  { icon: "lock", text: "Acompte protégé jusqu'à la visite" },
  { icon: "forum", text: "Échanges gardés dans l'application" },
];

export default function WelcomePage() {
  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-card lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:shadow-soft">
        <div className="relative h-72 shrink-0">
          <Image
            src="/img/listings/demo-1.jpg"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="392px"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 to-transparent p-6 pt-16">
            <h1 className="text-2xl font-extrabold leading-tight text-white">
              Trouvez un vrai logement, sans arnaque.
            </h1>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-6">
          <ul className="space-y-4">
            {POINTS.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="icon-badge size-10 shrink-0">
                  <Icon name={icon} size={22} />
                </span>
                <span className="text-[15px] font-medium">{text}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3">
            <Link
              href="/explore"
              className="flex items-center justify-center rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-btn"
            >
              Commencer
            </Link>
            <Link href="/login" className="block text-center text-base font-semibold text-primary">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}