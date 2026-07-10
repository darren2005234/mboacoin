"use client";

import { useState, useTransition } from "react";
import { completeProfile } from "./actions";
import { Wordmark } from "@/components/mboacoin/wordmark";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/account-types";

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [accountType, setAccountType] = useState("personne_physique");

  function action(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await completeProfile(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <main className="app-ambient flex min-h-dvh w-full items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col justify-center overflow-hidden bg-card p-6 lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark />
          <h1 className="mt-4 text-2xl font-extrabold">Bienvenue sur MboaCoin</h1>
          <p className="text-sm text-muted-foreground">
            Encore une étape : dites-nous qui vous êtes.
          </p>
        </div>

        <form action={action} className="mt-8 space-y-5">
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

          <div>
            <label className="field-label">Type de compte</label>
            <div className="flex flex-col gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountType(t)}
                  className={
                    accountType === t
                      ? "rounded-xl bg-primary px-4 py-3 text-left text-sm font-bold text-primary-foreground"
                      : "rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                  }
                >
                  {ACCOUNT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <input type="hidden" name="account_type" value={accountType} />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Enregistrement..." : "Continuer"}
          </Button>
        </form>
      </div>
    </main>
  );
}