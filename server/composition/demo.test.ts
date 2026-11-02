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

describe("demo local Time Trial composition", () => {
  it.each([
    ["tabarnia-time-trial-queens-01", "queens", "Queens"],
    ["tabarnia-time-trial-connect-pairs-01", "connect-pairs", "Flow Free"],
  ] as const)("loads the approved %s fixture", (id, format, title) => {
    const definition = createDemoReadServices().localTimeTrial.getDefinition(id);
    expect(definition?.challenge).toMatchObject({ id, mode: "time-trial", title });
    expect(definition?.challenge.slots).toHaveLength(6);
    expect(definition?.levels).toHaveLength(6);
    expect(definition?.challenge.slots.every((slot) => slot.questionType === format)).toBe(true);
    expect(definition?.challenge.timeLimitMs).toBe(150_000);
    expect(definition?.challenge.slots.reduce((sum, slot) => sum + slot.points, 0)).toBe(100);
  });

  it("does not compose other identifiers as local Time Trial rehearsals", () => {
    expect(
      createDemoReadServices().localTimeTrial.getDefinition("tabarnia-time-trial-queens-02"),
    ).toBeNull();
  });
});

describe("demo local Alphabet composition", () => {
  it("loads the complete Kingdom of Animals fixture independent of its publication window", () => {
    const definition =
      createDemoReadServices().localAlphabet.getDefinition("tabarnia-challenge-02");
    expect(definition?.challenge).toMatchObject({
      id: "tabarnia-challenge-02",
      mode: "alphabet",
      title: "Reino de animales",
      timeLimitMs: 150_000,
      maxScore: 100,
    });
    expect(definition?.challenge.entries).toHaveLength(16);
    expect(definition?.levels).toHaveLength(16);
    expect(definition?.challenge.entries.reduce((sum, entry) => sum + entry.points, 0)).toBe(100);
  });

  it("does not compose another scheduled id as a local Alphabet rehearsal", () => {
    expect(
      createDemoReadServices().localAlphabet.getDefinition("tabarnia-challenge-04"),
    ).toBeNull();
  });
});
