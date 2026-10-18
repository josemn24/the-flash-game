import { describe, expect, it } from "vitest";
import { createDemoReadServices } from "./demo";

describe("demo local Pyramid composition", () => {
  it("loads the canonical seven-level mock regardless of its publication window", () => {
    const definition = createDemoReadServices().localPyramid.getDefinition("tabarnia-challenge-05");
    expect(definition?.challenge.id).toBe("tabarnia-challenge-05");
    expect(definition?.challenge.availableUntil).toBe("9999-12-31T23:59:59.999Z");
    expect(definition?.challenge.levels.map((level) => level.questionType)).toEqual([
      "odd-one-out",
      "multiple-choice",
      "ordering",
      "logic-matrix",
      "connect-pairs",
      "logic-code",
      "queens",
    ]);
  });

  it("does not compose any other challenge as a local rehearsal", () => {
    expect(createDemoReadServices().localPyramid.getDefinition("tabarnia-challenge-06")).toBeNull();
  });
});
