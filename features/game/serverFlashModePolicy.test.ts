import { describe, expect, it } from "vitest";
import { isTerminalForServerFlashMode, supportsServerFlashDraft } from "./serverFlashModePolicy";

const flashChallenge = {
  id: "flash-1",
  definitionId: "definition-1",
  number: 1,
  title: "Flash",
  subtitle: "Flash",
  description: "Flash",
  mode: "flash" as const,
  maxScore: 20,
  slots: [
    {
      id: "question-1",
      position: 1,
      questionType: "multiple-choice" as const,
      payloadSchemaVersion: 1,
      timeLimitMs: 5_000,
      points: 10,
    },
    {
      id: "question-2",
      position: 2,
      questionType: "multiple-choice" as const,
      payloadSchemaVersion: 1,
      timeLimitMs: 5_000,
      points: 10,
    },
  ],
};

describe("server flash mode policy", () => {
  it("uses the current slot for normal Flash terminality", () => {
    expect(isTerminalForServerFlashMode(flashChallenge, 0, [])).toBe(false);
    expect(isTerminalForServerFlashMode(flashChallenge, 1, [])).toBe(true);
  });

  it("centralizes the final-answer draft question policy", () => {
    expect(supportsServerFlashDraft("matching")).toBe(true);
    expect(supportsServerFlashDraft("multiple-choice")).toBe(false);
    expect(supportsServerFlashDraft("queens")).toBe(false);
  });
});
