import { describe, expect, it } from "vitest";
import { findEditorialCapabilityIssue } from "./capabilityPreflight";
import type { FlashEditorialDocument } from "@/types/view-models/editorial";

function documentFor(
  mode: FlashEditorialDocument["challenge"]["mode"],
  question: Record<string, unknown>,
): FlashEditorialDocument {
  return {
    challenge: {
      slug: "capability-test",
      title: "Capability test",
      subtitle: "",
      description: "",
      mode,
      configSchemaVersion: 1,
      modeConfig: {},
    },
    questions: [question],
  } as unknown as FlashEditorialDocument;
}

describe("editorial capability preflight", () => {
  it("rejects a practice-only format in a competitive mode", () => {
    const result = findEditorialCapabilityIssue(
      documentFor("survival", {
        type: "flash-memory",
        payloadSchemaVersion: 1,
      }),
    );
    expect(result).toMatchObject({ code: "unsupported_question_type", questionIndex: 0 });
  });

  it("rejects short-text in Survival while keeping it valid for Alphabet", () => {
    expect(
      findEditorialCapabilityIssue(
        documentFor("survival", { type: "short-text", payloadSchemaVersion: 1 }),
      )?.code,
    ).toBe("unsupported_question_type");
    expect(
      findEditorialCapabilityIssue(
        documentFor("alphabet", { type: "short-text", payloadSchemaVersion: 1 }),
      ),
    ).toBeNull();
  });

  it("rejects an unsupported payload version", () => {
    const result = findEditorialCapabilityIssue(
      documentFor("narrative", {
        type: "mini-wordle",
        payloadSchemaVersion: 2,
      }),
    );
    expect(result).toMatchObject({ code: "unsupported_schema_version", questionIndex: 0 });
  });

  it("defers library references to the authoritative server validation", () => {
    expect(
      findEditorialCapabilityIssue(
        documentFor("narrative", {
          source: "library",
          questionVersionId: "00000000-0000-4000-8000-000000000000",
          points: 100,
          modeConfig: {},
        }),
      ),
    ).toBeNull();
  });
});
