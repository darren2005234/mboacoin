"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  className?: string;
}

/** Saisie du code de vérification (6 cases). Chiffres en Space Grotesk. */
export function OtpInput({ length = 6, value, onChange, onComplete, className }: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setChar = (index: number, char: string) => {
    const next = value.split("");
    next[index] = char;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (joined.length === length && !joined.includes("")) onComplete?.(joined);
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setChar(index, digit);
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        setChar(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setChar(index - 1, "");
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div className={cn("flex justify-between gap-2", className)} onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => {
        const filled = Boolean(value[i]);
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Chiffre ${i + 1}`}
            className={cn(
              "h-14 w-11 rounded-xl border-2 text-center font-mono text-lg font-bold transition-colors",
              "focus:outline-none focus:border-accent focus:ring-2 focus:ring-ring/25",
              filled ? "border-accent bg-brand-50 text-foreground" : "border-border bg-card"
            )}
          />
        );
      })}
    </div>
  );
}