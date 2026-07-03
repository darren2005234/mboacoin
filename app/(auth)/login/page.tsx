"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneField } from "@/components/mboacoin/phone-field";
import { Wordmark } from "@/components/mboacoin/wordmark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      router.push(`/verify?tel=${encodeURIComponent(phone)}`);
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
          <Button size="lg" className="w-full" onClick={submit} disabled={!phone || loading}>
            {loading ? "Envoi en cours..." : "Recevoir le code"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Un code de vérification vous sera envoyé par SMS.
          </p>
        </div>
      </div>
    </main>
  );
}