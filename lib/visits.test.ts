import { describe, expect, test } from "vitest";
import { pickRelevantVisit, type Visit } from "@/lib/visits";

function makeVisit(overrides: Partial<Visit> & { id: string; status: string; createdAt: string }): Visit {
  return {
    listingId: "listing-1",
    listingTitle: "Logement",
    listingImage: "/img/listings/demo-1.jpg",
    listingLocation: "",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    conversationId: "conv-1",
    feeAmount: 0,
    codeAttempts: 0,
    scheduledAt: null,
    noShow: false,
    completedAt: null,
    cancelledAt: null,
    role: "locataire",
    other: { name: null, avatarUrl: null, verified: false },
    slots: [],
    ...overrides,
  };
}

describe("pickRelevantVisit", () => {
  test("retient la visite effectuee plutôt qu'une visite refusee plus récente (cas du bug réel)", () => {
    const effectuee = makeVisit({ id: "v1", status: "effectuee", createdAt: "2026-01-01T00:00:00Z" });
    const refusee = makeVisit({ id: "v2", status: "refusee", createdAt: "2026-02-01T00:00:00Z" });

    expect(pickRelevantVisit([effectuee, refusee])).toBe(effectuee);
    expect(pickRelevantVisit([refusee, effectuee])).toBe(effectuee);
  });

  test("exclut annulee, refusee et expiree même si elles sont les plus récentes", () => {
    const confirmee = makeVisit({ id: "v1", status: "confirmee", createdAt: "2026-01-01T00:00:00Z" });
    const annulee = makeVisit({ id: "v2", status: "annulee", createdAt: "2026-03-01T00:00:00Z" });
    const expiree = makeVisit({ id: "v3", status: "expiree", createdAt: "2026-04-01T00:00:00Z" });

    expect(pickRelevantVisit([confirmee, annulee, expiree])).toBe(confirmee);
  });

  test("retourne null quand toutes les visites sont dans un statut terminal négatif", () => {
    const refusee = makeVisit({ id: "v1", status: "refusee", createdAt: "2026-01-01T00:00:00Z" });
    const annulee = makeVisit({ id: "v2", status: "annulee", createdAt: "2026-02-01T00:00:00Z" });

    expect(pickRelevantVisit([refusee, annulee])).toBeNull();
  });

  test("retourne null pour un tableau vide", () => {
    expect(pickRelevantVisit([])).toBeNull();
  });

  test("retourne l'unique visite non exclue", () => {
    const demandee = makeVisit({ id: "v1", status: "demandee", createdAt: "2026-01-01T00:00:00Z" });
    expect(pickRelevantVisit([demandee])).toBe(demandee);
  });

  test("parmi plusieurs visites non exclues, retient la plus récente quel que soit l'ordre du tableau", () => {
    const demandee = makeVisit({ id: "v1", status: "demandee", createdAt: "2026-01-01T00:00:00Z" });
    const confirmee = makeVisit({ id: "v2", status: "confirmee", createdAt: "2026-05-01T00:00:00Z" });
    const creneauPropose = makeVisit({ id: "v3", status: "creneau_propose", createdAt: "2026-03-01T00:00:00Z" });

    expect(pickRelevantVisit([demandee, confirmee, creneauPropose])).toBe(confirmee);
    expect(pickRelevantVisit([confirmee, creneauPropose, demandee])).toBe(confirmee);
  });
});
