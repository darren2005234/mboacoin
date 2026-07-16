import { describe, expect, test } from "vitest";
import { validateMessageAttachments, MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_RAW_SIZE_MB } from "@/lib/messages";

function image(size = 1024): { type: string; size: number } {
  return { type: "image/jpeg", size };
}

describe("validateMessageAttachments", () => {
  test("refuse un message sans texte et sans pièce jointe", () => {
    expect(validateMessageAttachments([], false)).toBeTruthy();
  });

  test("accepte un texte seul, sans pièce jointe", () => {
    expect(validateMessageAttachments([], true)).toBeNull();
  });

  test("accepte une image seule, sans texte (cas d'usage explicite : \"voici le quartier\")", () => {
    expect(validateMessageAttachments([image()], false)).toBeNull();
  });

  test("refuse au-delà du plafond par message", () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => image());
    expect(validateMessageAttachments(files, true)).toBeTruthy();
  });

  test("accepte exactement le plafond", () => {
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, () => image());
    expect(validateMessageAttachments(files, true)).toBeNull();
  });

  test("refuse un fichier qui n'est pas une image", () => {
    expect(validateMessageAttachments([{ type: "application/pdf", size: 1024 }], true)).toBeTruthy();
  });

  test("refuse une image trop volumineuse", () => {
    const tooLarge = image((MAX_ATTACHMENT_RAW_SIZE_MB + 1) * 1024 * 1024);
    expect(validateMessageAttachments([tooLarge], true)).toBeTruthy();
  });
});
