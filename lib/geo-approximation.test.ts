import { describe, expect, test } from "vitest";
import { roundCoordinate, APPROX_RADIUS_METERS } from "@/lib/geo-approximation";

describe("roundCoordinate", () => {
  test("arrondit à 2 décimales", () => {
    expect(roundCoordinate(4.0511234)).toBe(4.05);
    expect(roundCoordinate(9.7679001)).toBe(9.77);
  });

  test("fonctionne pour une coordonnée négative (longitude ouest)", () => {
    expect(roundCoordinate(-9.7679001)).toBe(-9.77);
  });

  test("ne change pas une valeur déjà à 2 décimales", () => {
    expect(roundCoordinate(4.05)).toBe(4.05);
  });
});

describe("APPROX_RADIUS_METERS", () => {
  test("excède le pire décalage possible de l'arrondi à 2 décimales (~785 m), pour que le cercle contienne toujours le point exact", () => {
    // Décalage max par coordonnée à 2 décimales : ~555 m (0.005° de marge,
    // ~111 km par degré). Pire cas combiné (latitude ET longitude) : diagonale.
    const maxOffsetPerAxisMeters = 0.005 * 111_000;
    const worstCaseCombinedMeters = Math.sqrt(2) * maxOffsetPerAxisMeters;
    expect(APPROX_RADIUS_METERS).toBeGreaterThan(worstCaseCombinedMeters);
  });
});
