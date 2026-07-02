"use client";

import "react-phone-number-input/style.css";
import PhoneInput from "react-phone-number-input";
import { cn } from "@/lib/utils";

interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Champ téléphone international avec sélecteur de pays. Sort un numéro au format E.164 (+237...). */
export function PhoneField({ value, onChange, className }: PhoneFieldProps) {
  return (
    <div
      className={cn(
        "mboa-phone flex items-center rounded-xl border border-input bg-card px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-ring/25",
        className
      )}
    >
      <PhoneInput
        international
        defaultCountry="CM"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        placeholder="Numéro de téléphone"
        className="flex-1"
      />
    </div>
  );
}