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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Wordmark />
        <h1 className="mt-4 text-xl font-extrabold">Bienvenue</h1>
        <p className="text-sm text-muted-foreground">
          Connectez-vous avec votre numéro pour continuer.
        </p>
      </div>

      <div className="space-y-4">
        <PhoneField value={phone} onChange={setPhone} />
        {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}
        <Button size="lg" className="w-full" onClick={submit} disabled={!phone || loading}>
          {loading ? "Envoi en cours..." : "Recevoir le code"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Un code de vérification vous sera envoyé par SMS.
        </p>
      </div>
    </main>
  );
}