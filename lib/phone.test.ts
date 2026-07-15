import { describe, expect, test } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  test("des indicatifs pays différents ne collisionnent jamais (non-régression de la faille de sécurité)", () => {
    expect(normalizePhone("+237600000003")).not.toBe(normalizePhone("+33600000003"));
  });

  test("conserve l'indicatif pays complet (E.164)", () => {
    expect(normalizePhone("+237600000003")).toBe("237600000003");
  });

  test("un même numéro écrit avec ou sans '+', avec ou sans espaces/tirets, normalise pareil", () => {
    const expected = "237600000003";
    expect(normalizePhone("+237600000003")).toBe(expected);
    expect(normalizePhone("237600000003")).toBe(expected);
    expect(normalizePhone("+237 6 00 00 00 03")).toBe(expected);
    expect(normalizePhone("+237-600-000-003")).toBe(expected);
  });

  test("entrée vide ou null normalise vers une chaîne vide", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
  });
});
