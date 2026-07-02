import { TrustSeal, TrustSealBadge } from "@/components/mboacoin/trust-seal";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <TrustSeal size={48} />
        <TrustSeal size={48} tone="pending" />
      </div>
      <TrustSealBadge label="Profil vérifié" />
      <TrustSealBadge label="Non vérifié" tone="pending" />
      <p className="text-sm text-muted-foreground">
        Prix exemple : <span className="font-mono font-bold text-primary">150 000 F</span>
      </p>
    </main>
  );
}