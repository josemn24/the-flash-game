import { describe, expect, it } from "vitest";
import { getMiniWordleFeedback, normalizeMiniWordleWord } from "./miniWordle";

describe("Mini-Wordle rules", () => {
  it("normalizes Spanish diacritics while preserving Ñ", () => {
    expect(normalizeMiniWordleWord("  cañón ")).toBe("CAÑON");
    expect(normalizeMiniWordleWord("áéíóúü")).toBe("AEIOUU");
    expect(normalizeMiniWordleWord("Jesús")).toBe("JESUS");
    expect(normalizeMiniWordleWord("Josué")).toBe("JOSUE");
  });

  it("allocates repeated letters with correct Wordle precedence", () => {
    expect(getMiniWordleFeedback("CAÑA", "AÑAS")).toEqual([
      { letter: "C", status: "absent" },
      { letter: "A", status: "present" },
      { letter: "Ñ", status: "present" },
      { letter: "A", status: "present" },
    ]);
    expect(getMiniWordleFeedback("SALA", "CASA")).toEqual([
      { letter: "S", status: "present" },
      { letter: "A", status: "correct" },
      { letter: "L", status: "absent" },
      { letter: "A", status: "correct" },
    ]);
  });
});
