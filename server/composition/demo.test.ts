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

describe("demo local Flash composition", () => {
  it("loads the canonical 16-question Steel Ball Run fixture independent of its window", () => {
    const definition = createDemoReadServices().localFlash.getDefinition("tabarnia-flash-01");
    expect(definition?.challenge).toMatchObject({ id: "tabarnia-flash-01", mode: "flash" });
    expect(definition?.challenge.title).toBe("Steel Ball Run");
    expect(definition?.challenge.slots).toHaveLength(16);
    expect(definition?.levels).toHaveLength(16);
    expect(definition?.challenge.slots.reduce((sum, slot) => sum + slot.points, 0)).toBe(
      definition?.challenge.maxScore,
    );
  });

  it("does not compose other scheduled ids as a local Flash rehearsal", () => {
    expect(createDemoReadServices().localFlash.getDefinition("tabarnia-flash-02")).toBeNull();
  });
});
