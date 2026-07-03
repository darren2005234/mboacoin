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
      const { data, error } = await supabase.auth.verifyOtp({
        phone: tel,
        token: value,
        type: "sms",
      });
      if (error) throw error;

      const userId = data.user?.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId!)
        .maybeSingle();

      if (profile?.full_name) {
        router.push("/explore");
      } else {
        router.push("/onboarding");
      }
    } catch {
      setError("Code invalide ou expiré. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col justify-center overflow-hidden bg-card p-6 lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <button
          onClick={() => router.push("/login")}
          aria-label="Retour"
          className="absolute left-6 top-6 grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="icon-badge size-14">
            <MessageSquare className="size-6" strokeWidth={2.25} />
          </span>
          <h1 className="mt-2 text-2xl font-extrabold">Entrez le code</h1>
          <p className="text-sm text-muted-foreground">
            Envoyé par SMS au <span className="font-mono font-bold text-foreground">{tel}</span>
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <OtpInput value={code} onChange={setCode} onComplete={verify} />
          {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
          <Button
            size="lg"
            className="w-full"
            disabled={code.length < 6 || loading}
            onClick={() => verify(code)}
          >
            {loading ? "Vérification..." : "Vérifier et continuer"}
          </Button>
        </div>
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