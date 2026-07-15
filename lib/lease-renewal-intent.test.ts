import { describe, expect, test } from "vitest";
import { currentRenewalIntent, type LeaseRenewalIntent } from "@/lib/lease-renewal-intent";

function makeIntent(overrides: Partial<LeaseRenewalIntent> = {}): LeaseRenewalIntent {
  return {
    intent: "reste",
    coverageEndDate: "2026-08-01",
    respondedAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("currentRenewalIntent", () => {
  test("renvoie null quand le bail n'a pas de endDate", () => {
    expect(currentRenewalIntent(null, makeIntent())).toBeNull();
  });

  test("renvoie null quand il n'y a pas de réponse enregistrée", () => {
    expect(currentRenewalIntent("2026-08-01", undefined)).toBeNull();
  });

  test("renvoie null quand la réponse concerne un cycle de couverture dépassé", () => {
    const intent = makeIntent({ coverageEndDate: "2026-08-01" });
    // Un nouveau versement a prolongé le bail : end_date a changé depuis la réponse.
    expect(currentRenewalIntent("2026-11-01", intent)).toBeNull();
  });

  test("renvoie l'intention quand coverageEndDate correspond au endDate actuel du bail", () => {
    const intent = makeIntent({ intent: "part", coverageEndDate: "2026-08-01" });
    expect(currentRenewalIntent("2026-08-01", intent)).toBe("part");
  });
});
