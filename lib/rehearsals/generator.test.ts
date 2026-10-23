import { expect, it } from "vitest";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";
import { rehearsalTemplates } from "@/test-utils/rehearsals/fixtures";
import {
  generateRehearsal,
  rehearsalCoverage,
  replayRehearsal,
  rehearsalCandidates,
} from "./generator";
const bank = rehearsalBank();
const t = rehearsalTemplates.find((t) => t.mode === "time-trial")!;
it("is deterministic and varies across seeds without changing the template", () => {
  const before = JSON.stringify({ bank, t });
  const a = generateRehearsal(bank, t, "seed");
  expect(generateRehearsal([...bank].reverse(), t, "seed").recipe.questions).toEqual(
    a.recipe.questions,
  );
  expect(generateRehearsal(bank, t, "seed")).toEqual(a);
  expect(replayRehearsal(bank, t, a.recipe)).toEqual(a);
  const sequences = new Set(
    Array.from({ length: 12 }, (_, i) =>
      JSON.stringify(generateRehearsal(bank, t, `seed-${i}`).recipe.questions),
    ),
  );
  expect(sequences.size).toBeGreaterThan(1);
  expect(JSON.stringify({ bank, t })).toBe(before);
  expect(new Set(a.recipe.questions.map((q) => q.id)).size).toBe(t.questions.length);
  expect(a.definition.levels.map((q) => q.publicQuestion.prompt)).not.toContain(t.title);
});
it("uses nearest difficulty and prefers the lower one in a tie", () => {
  const q = rehearsalCandidates(bank, t, 0)[0]!;
  const choices = [
    { ...q, id: "easy", difficulty: "easy" as const },
    { ...q, id: "hard", difficulty: "hard" as const },
  ];
  const one = { ...t, questions: t.questions.slice(0, 2) };
  const result = generateRehearsal(
    choices,
    { ...one, questions: one.questions.map((q) => ({ ...q, points: 50 })) },
    "difficulty",
  );
  expect(result.recipe.questions[0]!.id).toBe("easy");
  expect(result.recipe.questions[1]!.id).toBe("hard");
  expect(rehearsalCoverage(choices, t).slots[0]!.warnings).toContain(
    "Se utilizará una dificultad próxima",
  );
});
it("reports missing and invalid candidates before generation", () => {
  expect(rehearsalCoverage([], t).ready).toBe(false);
  expect(() => generateRehearsal([], t, "empty")).toThrow("coverage");
  const imageTemplate = rehearsalTemplates.find((t) =>
    t.questions.some((q) => q.type === "progressive-image"),
  )!;
  const i = imageTemplate.questions.findIndex((q) => q.type === "progressive-image");
  expect(
    rehearsalCandidates(
      bank,
      {
        ...imageTemplate,
        questions: imageTemplate.questions.map((q, j) => (j === i ? { ...q, timeLimitMs: 1 } : q)),
      },
      i,
    ),
  ).toEqual([]);
});
it("repeats only after exhausting candidates and rejects damaged recipes", () => {
  const choices = rehearsalCandidates(bank, t, 0).slice(0, 2);
  const result = generateRehearsal(choices, t, "repeat");
  expect(result.recipe.questions[0]!.id).not.toBe(result.recipe.questions[1]!.id);
  expect(() => replayRehearsal(choices, t, { ...result.recipe, templateHash: "wrong" })).toThrow(
    "incompatible",
  );
  expect(() => replayRehearsal(choices, t, { ...result.recipe, seed: "altered" })).toThrow(
    "incompatible",
  );
  expect(() =>
    replayRehearsal(
      choices.map((q) => ({ ...q, version: q.version + 1 })),
      t,
      result.recipe,
    ),
  ).toThrow("missing");
});
it("keeps exhaustion cycles independent across formats", () => {
  const a = bank.find((q) => q.type === "true-false")!;
  const b = bank.filter((q) => q.type === "multiple-choice").slice(0, 2);
  const source = {
    ...rehearsalTemplates.find((t) => t.mode === "flash")!,
    questions: [a, b[0]!, a, b[0]!].map((q) => ({
      type: q.type,
      payloadSchemaVersion: q.payloadSchemaVersion,
      difficulty: q.difficulty,
      timeLimitMs: 30000,
      points: 25,
      modeConfig: {},
      mechanics: {},
    })),
  };
  const result = generateRehearsal([a, ...b], source, "independent-cycles");
  expect(result.recipe.questions[1]!.id).not.toBe(result.recipe.questions[3]!.id);
});
it("prefers exact difficulty before families and keeps every eligible choice reachable", () => {
  const q = rehearsalCandidates(bank, t, 0)[0]!;
  const choices = [
    { ...q, id: "first", familyId: "shared", difficulty: "medium" as const },
    { ...q, id: "second", familyId: "shared", difficulty: "medium" as const },
    { ...q, id: "third", familyId: "independent", difficulty: "medium" as const },
    { ...q, id: "easier", familyId: "easy", difficulty: "easy" as const },
  ];
  const source = { ...t, questions: t.questions.slice(0, 2).map((s) => ({ ...s, points: 50 })) };
  const reached = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const result = generateRehearsal(choices, source, `families-${i}`);
    const selected = result.recipe.questions.map((ref) => choices.find((q) => q.id === ref.id)!);
    expect(selected.every((q) => q.difficulty === "medium")).toBe(true);
    expect(selected[0]!.familyId).not.toBe(selected[1]!.familyId);
    reached.add(selected[0]!.id);
  }
  expect([...reached].sort()).toEqual(["first", "second", "third"]);
});
it("uses latest identities for new sessions and retains exact old versions for replay", () => {
  const old = rehearsalCandidates(bank, t, 0)[0]!;
  const original = generateRehearsal([old], t, "before-correction");
  const next = { ...old, version: old.version + 1 };
  const updated = [old, next];
  expect(
    generateRehearsal(updated, t, "after-correction").recipe.questions.every(
      (q) => q.version === next.version,
    ),
  ).toBe(true);
  expect(replayRehearsal(updated, t, original.recipe)).toEqual(original);
  expect(() => replayRehearsal([{ ...old, difficulty: "hard" }], t, original.recipe)).toThrow(
    "changed",
  );
});
it("requires the letter, supported contract and declared mode for every candidate", () => {
  const alphabet = rehearsalTemplates.find((t) => t.mode === "alphabet")!;
  const letter = rehearsalCandidates(bank, alphabet, 0)[0]!;
  expect(rehearsalCandidates([{ ...letter, alphabetLetter: "Ñ" }], alphabet, 0)).toEqual([]);
  expect(rehearsalCandidates([{ ...letter, payloadSchemaVersion: 999 }], alphabet, 0)).toEqual([]);
  expect(
    rehearsalCandidates(
      [letter],
      {
        ...alphabet,
        questions: alphabet.questions.map((q) => ({ ...q, payloadSchemaVersion: 999 })),
      },
      0,
    ),
  ).toEqual([]);
  expect(rehearsalCandidates([{ ...letter, modes: ["flash"] }], alphabet, 0)).toEqual([]);
});
it.each(rehearsalTemplates)(
  "preserves all positions and mode rules in $challengeVersionId",
  (source) => {
    const before = JSON.stringify(source);
    const { definition } = generateRehearsal(bank, source, "structure");
    const c = definition.challenge;
    const slots = c.mode === "alphabet" ? c.entries : c.mode === "pyramid" ? c.levels : c.slots;
    expect(
      slots.map((s) => ({ type: s.questionType, time: s.timeLimitMs, points: s.points })),
    ).toEqual(
      source.questions.map((s) => ({ type: s.type, time: s.timeLimitMs, points: s.points })),
    );
    if (c.mode === "alphabet" || c.mode === "time-trial")
      expect(c.timeLimitMs).toBe(source.globalTimeLimitMs);
    if (c.mode === "survival") expect(c.lives).toBe(source.modeConfig.lives);
    expect(JSON.stringify(source)).toBe(before);
  },
);
