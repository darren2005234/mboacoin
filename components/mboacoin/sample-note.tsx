const LOW_SAMPLE_THRESHOLD = 10;

/** Indique la taille de l'échantillon d'une statistique, signale explicitement si elle est trop faible. */
export function SampleNote({ size, unit = "recherche" }: { size: number; unit?: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Calculé sur {size} {unit}
      {size > 1 ? "s" : ""}.
      {size < LOW_SAMPLE_THRESHOLD && (
        <span className="ml-1 font-semibold text-pending-text">Échantillon trop faible pour être significatif.</span>
      )}
    </p>
  );
}
