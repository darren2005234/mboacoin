"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFCFA } from "@/lib/utils";
import { requestVisit } from "@/lib/visits";
import { createClient } from "@/lib/supabase/client";
import { loginUrl } from "@/lib/auth-redirect";

interface RequestVisitButtonProps {
  listingId: string;
  feeAmount: number;
}

export function RequestVisitButton({ listingId, feeAmount }: RequestVisitButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSlot(index: number, value: string) {
    setSlots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addSlot() {
    if (slots.length < 3) setSlots((prev) => [...prev, ""]);
  }

  async function submit() {
    setError(null);
    const filled = slots.filter(Boolean);
    if (filled.length < 2) {
      setError("Proposez au moins 2 créneaux.");
      return;
    }
    const dates = filled.map((s) => new Date(s));
    if (dates.some((d) => Number.isNaN(d.getTime()) || d.getTime() <= Date.now())) {
      setError("Les créneaux doivent être des dates valides, dans le futur.");
      return;
    }

    setLoading(true);
    const result = await requestVisit(listingId, dates);
    setLoading(false);

    if (result.error === "not-authenticated") {
      router.push(loginUrl());
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/visits/${result.id}`);
  }

  async function openForm() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(loginUrl());
      return;
    }
    setOpen(true);
  }

  if (!open) {
    return (
      <Button size="lg" className="flex-1" onClick={openForm}>
        <CalendarDays className="size-5" /> Visiter
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Proposer des créneaux de visite</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted-foreground"
        >
          Annuler
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {feeAmount > 0 ? `Frais de visite : ${formatFCFA(feeAmount)} FCFA` : "Visite gratuite"}
      </p>
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <Input
            key={i}
            type="datetime-local"
            value={slot}
            onChange={(e) => updateSlot(i, e.target.value)}
          />
        ))}
      </div>
      {slots.length < 3 && (
        <button type="button" onClick={addSlot} className="text-xs font-bold text-accent">
          + Ajouter un créneau
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="lg" className="w-full" onClick={submit} disabled={loading}>
        {loading ? "Envoi..." : "Envoyer la demande"}
      </Button>
    </div>
  );
}
