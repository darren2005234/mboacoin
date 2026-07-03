"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  /** Nombre de caractères affichés avant "Voir plus". */
  limit?: number;
}

/** Affiche un texte long avec un lien "Voir plus / Voir moins". */
export function ExpandableText({ text, limit = 220 }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > limit;
  const shown = expanded || !isLong ? text : text.slice(0, limit).trimEnd() + "…";

  return (
    <div className="space-y-1">
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/80">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold text-primary"
        >
          {expanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
}