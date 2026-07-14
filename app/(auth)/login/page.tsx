"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhoneField } from "@/components/mboacoin/phone-field";
import { Wordmark } from "@/components/mboacoin/wordmark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth-redirect";

function LoginInner() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const isValid = phone.length >= 8 && accepted;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      const verifyUrl = `/verify?tel=${encodeURIComponent(phone)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
      router.push(verifyUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col justify-center overflow-hidden bg-card p-6 lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark />
          <h1 className="mt-4 text-2xl font-extrabold">Connexion ou inscription</h1>
          <p className="text-sm text-muted-foreground">
            Entrez votre numéro. On vous crée un compte si vous n&apos;en avez pas encore.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <PhoneField value={phone} onChange={setPhone} />
          {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
          <label className="flex items-start gap-2.5 text-left">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              J&apos;ai lu et j&apos;accepte les{" "}
              <a href="/legal/conditions" target="_blank" className="font-semibold text-primary underline">
                Conditions d&apos;utilisation
              </a>{" "}
              et la{" "}
              <a href="/legal/confidentialite" target="_blank" className="font-semibold text-primary underline">
                Politique de confidentialité
              </a>
              .
            </span>
          </label>
          <Button size="lg" className="w-full" onClick={submit} disabled={!isValid || loading}>
            {loading ? "Envoi en cours..." : "Recevoir le code"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Un code de vérification vous sera envoyé par SMS.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Impossible d&apos;accéder à votre compte ?{" "}
            <a href="/support" className="font-semibold text-primary underline">
              Contacter le support
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}