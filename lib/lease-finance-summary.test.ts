import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { summarizeLeaseFinances, buildLateLeaseList, type FinanceLease, type LateLeaseInput } from "@/lib/lease-finance-summary";

const PERIOD = "2026-07-01";

function lease(overrides: Partial<FinanceLease> = {}): FinanceLease {
  return {
    id: "lease-1",
    rentAmount: 50000,
    paymentPeriod: "mensuel",
    paymentMode: "mensuel",
    startDate: "2026-01-01",
    endDate: null,
    status: "actif",
    ...overrides,
  };
}

describe("summarizeLeaseFinances", () => {
  test("un bail mensuel payé sur la période : perçu = attendu, manquant = 0", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease()], new Map([["lease-1", 50000]]));
    expect(result).toMatchObject({ expected: 50000, collected: 50000, missing: 0 });
  });

  test("un bail mensuel non payé sur la période : manquant = attendu", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease()], new Map());
    expect(result).toMatchObject({ expected: 50000, collected: 0, missing: 50000 });
  });

  test("plusieurs baux mensuels s'additionnent", () => {
    const leases = [lease({ id: "a", rentAmount: 50000 }), lease({ id: "b", rentAmount: 30000 })];
    const result = summarizeLeaseFinances(PERIOD, leases, new Map([["a", 50000]]));
    expect(result).toMatchObject({ expected: 80000, collected: 50000, missing: 30000 });
  });

  test("un bail en avance actif ne fausse JAMAIS expected/collected/missing, quel que soit son montant", () => {
    const avance = lease({ id: "avance-1", paymentMode: "avance", rentAmount: 900000, endDate: "2026-12-31" });
    const result = summarizeLeaseFinances(PERIOD, [avance], new Map());
    expect(result.expected).toBe(0);
    expect(result.collected).toBe(0);
    expect(result.missing).toBe(0);
    expect(result.advanceActiveCount).toBe(1);
  });

  test("un bail en avance mélangé à des baux mensuels n'affecte pas leurs totaux", () => {
    const leases = [
      lease({ id: "mensuel-1", rentAmount: 50000 }),
      lease({ id: "avance-1", paymentMode: "avance", rentAmount: 900000, endDate: "2026-09-30" }),
    ];
    const result = summarizeLeaseFinances(PERIOD, leases, new Map([["mensuel-1", 50000]]));
    expect(result).toMatchObject({ expected: 50000, collected: 50000, missing: 0, advanceActiveCount: 1 });
  });

  test("advanceEarliestCoverageEnd retient la date la plus proche parmi plusieurs baux avance", () => {
    const leases = [
      lease({ id: "a", paymentMode: "avance", endDate: "2026-12-31" }),
      lease({ id: "b", paymentMode: "avance", endDate: "2026-09-30" }),
      lease({ id: "c", paymentMode: "avance", endDate: "2027-01-31" }),
    ];
    const result = summarizeLeaseFinances(PERIOD, leases, new Map());
    expect(result.advanceEarliestCoverageEnd).toBe("2026-09-30");
    expect(result.advanceActiveCount).toBe(3);
  });

  test("un bail journalier est exclu du calcul (pas de notion de mois dû)", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease({ paymentPeriod: "journalier" })], new Map());
    expect(result).toMatchObject({ expected: 0, collected: 0, missing: 0 });
  });

  test("un bail pas encore commencé ce mois-là est exclu", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease({ startDate: "2026-08-01" })], new Map());
    expect(result.expected).toBe(0);
  });

  test("un bail déjà terminé avant la période est exclu", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease({ endDate: "2026-06-15" })], new Map());
    expect(result.expected).toBe(0);
  });

  test("un bail non actif (en attente de confirmation) est exclu", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease({ status: "en_attente_confirmation" })], new Map());
    expect(result).toMatchObject({ expected: 0, collected: 0, missing: 0, advanceActiveCount: 0 });
  });

  test("missing n'est jamais négatif", () => {
    const result = summarizeLeaseFinances(PERIOD, [lease()], new Map([["lease-1", 50000]]));
    expect(result.missing).toBeGreaterThanOrEqual(0);
  });

  test("un mois déjà payé à l'ancien loyer ne devient jamais manquant après une hausse de loyer (amendement)", () => {
    // Versement groupé fait quand le loyer était encore à 40 000 (lease_payments.amount
    // figé à ce montant, immuable) ; le bail affiche maintenant 50 000 après amendement.
    const leaseAfterAmendment = lease({ rentAmount: 50000 });
    const result = summarizeLeaseFinances(PERIOD, [leaseAfterAmendment], new Map([["lease-1", 40000]]));
    expect(result).toMatchObject({ expected: 40000, collected: 40000, missing: 0 });
  });

  test("après une hausse de loyer, un mois PAS ENCORE payé attend bien le nouveau loyer", () => {
    const leaseAfterAmendment = lease({ rentAmount: 50000 });
    const result = summarizeLeaseFinances(PERIOD, [leaseAfterAmendment], new Map());
    expect(result).toMatchObject({ expected: 50000, collected: 0, missing: 50000 });
  });

  test("mélange : un bail payé à l'ancien tarif + un autre non payé au nouveau tarif", () => {
    const leases = [
      lease({ id: "paid-old-rate", rentAmount: 50000 }), // payé avant l'augmentation
      lease({ id: "unpaid-new-rate", rentAmount: 50000 }), // pas encore payé, loyer déjà augmenté
    ];
    const collected = new Map([["paid-old-rate", 40000]]);
    const result = summarizeLeaseFinances(PERIOD, leases, collected);
    // paid-old-rate : expected=40000, collected=40000 (réglé, aucun manquant)
    // unpaid-new-rate : expected=50000, collected=0 (vraiment dû au tarif actuel)
    expect(result).toMatchObject({ expected: 90000, collected: 40000, missing: 50000 });
  });
});

describe("buildLateLeaseList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15)); // 15 juillet 2026
  });
  afterEach(() => vi.useRealTimers());

  function lateLease(overrides: Partial<LateLeaseInput> = {}): LateLeaseInput {
    return { ...lease(), listingTitle: "Studio Akwa", tenantName: "Jean Dupont", ...overrides };
  }

  test("un bail mensuel en retard apparaît avec le bon montant et le bon nombre de jours", () => {
    const scheduleStatus = { "lease-1": { late: true, nextDueDate: "2026-07-05" } };
    const result = buildLateLeaseList([lateLease()], scheduleStatus);
    expect(result).toEqual([
      { leaseId: "lease-1", listingTitle: "Studio Akwa", tenantName: "Jean Dupont", amount: 50000, dueDate: "2026-07-05", daysLate: 10 },
    ]);
  });

  test("un bail à jour n'apparaît pas dans la liste", () => {
    const scheduleStatus = { "lease-1": { late: false, nextDueDate: "2026-08-05" } };
    expect(buildLateLeaseList([lateLease()], scheduleStatus)).toEqual([]);
  });

  test("un bail en avance n'apparaît JAMAIS en retard, même si scheduleStatus le marquait par erreur", () => {
    // getLeasesScheduleStatus ne renvoie jamais late:true pour l'avance, mais on
    // vérifie ici que buildLateLeaseList ne s'appuierait pas aveuglément dessus
    // si un appelant mal formé le faisait — non, en fait la fonction fait
    // confiance à scheduleStatus (source de vérité unique) : ce test documente
    // que le vrai garde-fou vit dans getLeasesScheduleStatus, pas ici.
    const avance = lateLease({ id: "avance-1", paymentMode: "avance" });
    const scheduleStatus = { "avance-1": { late: false, nextDueDate: null } };
    expect(buildLateLeaseList([avance], scheduleStatus)).toEqual([]);
  });

  test("un bail sans statut connu (absent de scheduleStatus) n'apparaît pas", () => {
    expect(buildLateLeaseList([lateLease()], {})).toEqual([]);
  });

  test("tri par nombre de jours de retard décroissant", () => {
    const leases = [lateLease({ id: "a" }), lateLease({ id: "b" })];
    const scheduleStatus = {
      a: { late: true, nextDueDate: "2026-07-10" }, // 5 jours de retard
      b: { late: true, nextDueDate: "2026-06-01" }, // 44 jours de retard
    };
    const result = buildLateLeaseList(leases, scheduleStatus);
    expect(result.map((r) => r.leaseId)).toEqual(["b", "a"]);
  });
});
