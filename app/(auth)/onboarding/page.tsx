"use client";

import { useState, useTransition } from "react";
import { completeProfile } from "./actions";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function action(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await completeProfile(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="screen-title">Bienvenue sur MboaCoin</h1>
        <p className="screen-subtitle mt-1">
          Encore une étape : dites-nous qui vous êtes.
        </p>
      </div>

      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="full_name" className="field-label">
            Nom complet
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            placeholder="Ex : Darren Touopi"
            className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        <div>
          <label htmlFor="city" className="field-label">
            Ville <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <input
            id="city"
            name="city"
            placeholder="Ex : Douala"
            className="w-full rounded-xl border border-input bg-card px-4 py-3.5 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Enregistrement..." : "Continuer"}
        </Button>
      </form>
    </main>
  );
}