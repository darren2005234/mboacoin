import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { daysUntil, dueDateForPeriod, generateDueDates, nextUnpaidDueDate, todayIso } from "@/lib/lease-schedule";

describe("generateDueDates", () => {
  test("normalise au 1er du mois même pour un bail commençant en milieu de mois", () => {
    const dates = generateDueDates("2026-01-15", "mensuel", new Date(2026, 0, 20));
    expect(dates).toEqual(["2026-01-01"]);
  });

  test("renvoie [] pour une périodicité journalière", () => {
    expect(generateDueDates("2026-01-01", "journalier", new Date(2026, 5, 1))).toEqual([]);
  });

  test("traverse la frontière d'année (décembre -> janvier)", () => {
    const dates = generateDueDates("2025-11-01", "mensuel", new Date(2026, 0, 1));
    expect(dates).toEqual(["2025-11-01", "2025-12-01", "2026-01-01"]);
  });
});

describe("dueDateForPeriod", () => {
  test("clampe le jour 31 sur le dernier jour d'un mois à 30 jours (avril)", () => {
    expect(dueDateForPeriod("2026-04-01", 31, "2026-01-01")).toBe("2026-04-30");
  });

  test("clampe le jour 31 sur février en année non bissextile (2026, 28 jours)", () => {
    expect(dueDateForPeriod("2026-02-01", 31, "2026-01-01")).toBe("2026-02-28");
  });

  test("clampe le jour 31 sur février en année bissextile (2028, 29 jours)", () => {
    expect(dueDateForPeriod("2028-02-01", 31, "2026-01-01")).toBe("2028-02-29");
  });

  test("retombe sur le jour de début de bail si paymentDay est absent", () => {
    expect(dueDateForPeriod("2026-03-01", null, "2026-01-17")).toBe("2026-03-17");
  });
});

describe("nextUnpaidDueDate", () => {
  test("une période payée n'est jamais en retard, même payée en avance (versement groupé couvrant un mois futur)", () => {
    // Janvier payé, février NON payé, mars déjà payé en avance : le premier vrai trou est février,
    // pas mars (qui a un paiement) ni janvier (qui a un paiement).
    const paid = new Set(["2026-01-01", "2026-03-01"]);
    const next = nextUnpaidDueDate("2026-01-01", 5, "mensuel", paid);
    expect(next).toBe("2026-02-05");
  });

  test("changer le jour de paiement ne transforme jamais un loyer payé en impayé", () => {
    const paid = new Set(["2026-01-01", "2026-02-01"]);
    const withDay5 = nextUnpaidDueDate("2026-01-01", 5, "mensuel", paid);
    const withDay28 = nextUnpaidDueDate("2026-01-01", 28, "mensuel", paid);
    expect(withDay5).toBe("2026-03-05");
    expect(withDay28).toBe("2026-03-28");
    // Même période retenue comme prochaine échéance dans les deux cas : le jour de paiement
    // change seulement la date affichée, jamais quelle période est considérée payée.
    expect(withDay5?.slice(0, 7)).toBe(withDay28?.slice(0, 7));
  });

  test("couverture d'un versement groupé de 3 mois consécutifs : la prochaine échéance est le 4e mois", () => {
    const paid = new Set(["2026-01-01", "2026-02-01", "2026-03-01"]);
    const next = nextUnpaidDueDate("2026-01-01", 1, "mensuel", paid);
    expect(next).toBe("2026-04-01");
  });

  test("renvoie null pour une périodicité journalière", () => {
    expect(nextUnpaidDueDate("2026-01-01", 1, "journalier", new Set())).toBeNull();
  });
});

describe("retard dérivé (dueDate < aujourd'hui), même règle que getLeasesScheduleStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15)); // 15 juillet 2026, heure locale
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("todayIso() reflète la date système figée", () => {
    expect(todayIso()).toBe("2026-07-15");
  });

  test("une échéance passée sans paiement est en retard", () => {
    const next = nextUnpaidDueDate("2026-01-01", 1, "mensuel", new Set(["2026-01-01"]));
    expect(next).toBe("2026-02-01");
    expect(next! < todayIso()).toBe(true);
  });

  test("une échéance future sans paiement n'est pas en retard", () => {
    const next = nextUnpaidDueDate("2026-08-01", 1, "mensuel", new Set());
    expect(next).toBe("2026-08-01");
    expect(next! < todayIso()).toBe(false);
  });

  test("daysUntil est négatif pour une date passée, positif pour une date future", () => {
    expect(daysUntil("2026-07-10")).toBe(-5);
    expect(daysUntil("2026-07-20")).toBe(5);
  });
});
