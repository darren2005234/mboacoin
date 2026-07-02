"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { OtpInput } from "@/components/mboacoin/otp-input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tel = params.get("tel") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(value: string) {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: tel,
        token: value,
        type: "sms",
      });
      if (error) throw error;
      router.push("/explore");
    } catch {
      setError("Code invalide ou expiré. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <button
        onClick={() => router.push("/login")}
        aria-label="Retour"
        className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-accent">
          <MessageSquare className="size-6" />
        </span>
        <h1 className="text-xl font-extrabold">Entrez le code</h1>
        <p className="text-sm text-muted-foreground">
          Envoyé par SMS au <span className="font-mono font-bold text-foreground">{tel}</span>
        </p>
      </div>

      <div className="space-y-4">
        <OtpInput value={code} onChange={setCode} onComplete={verify} />
        {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}
        <Button
          size="lg"
          className="w-full"
          disabled={code.length < 6 || loading}
          onClick={() => verify(code)}
        >
          {loading ? "Vérification..." : "Vérifier et continuer"}
        </Button>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}