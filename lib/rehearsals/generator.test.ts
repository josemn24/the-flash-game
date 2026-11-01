import { expect, it } from "vitest";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";
import { questionTemplate, rehearsalTemplates } from "@/test-utils/rehearsals/fixtures";
import { getWordSearchPath, isValidWordSearchConfiguration } from "@/lib/wordSearch";
import {
  generateRehearsal,
  rehearsalCoverage,
  rehearsalHash,
  replayRehearsal,
  rehearsalCandidates,
  templateHash,
} from "./generator";
const bank = rehearsalBank();
const t = rehearsalTemplates.find((t) => t.mode === "time-trial")!;

function wordSearchPublicQuestion(run: ReturnType<typeof generateRehearsal>, levelIndex = 0) {
  const question = run.definition.levels[levelIndex]?.publicQuestion;
  if (!question || question.type !== "word-search") throw new Error("Expected word search");
  return question;
}

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

it("generates seeded Spanish filler for rehearsal word searches and replays it", () => {
  const questions = bank.filter((question) => question.type === "word-search");
  expect(questions).toHaveLength(3);

  for (const source of questions) {
    const template = questionTemplate(source, "flash", [source]);
    const first = generateRehearsal([source], template, `filler-${source.id}`);
    const repeated = generateRehearsal([source], template, `filler-${source.id}`);
    const different = generateRehearsal([source], template, `other-${source.id}`);
    const firstQuestion = wordSearchPublicQuestion(first);
    const repeatedQuestion = wordSearchPublicQuestion(repeated);
    const differentQuestion = wordSearchPublicQuestion(different);
    const generatedLetters = firstQuestion.payload.letters;
    const sourcePayload = source.publicPayload as unknown as {
      grid: { rows: number; columns: number };
      letters: string[];
      targets: { id: string; word: string }[];
    };
    const positions = source.solutionPayload.positionsByTargetId as Record<
      string,
      { startCell: number; endCell: number }
    >;
    const targetPaths = sourcePayload.targets.map((target) => {
      const position = positions[target.id];
      if (!position) throw new Error("Expected word-search target positions");
      const path = getWordSearchPath(sourcePayload.grid, position.startCell, position.endCell);
      if (!path) throw new Error("Expected a valid word-search target path");
      return { target, path };
    });

    expect(first.recipe.generatorVersion).toBe(2);
    expect(repeated).toEqual(first);
    expect(replayRehearsal([source], template, first.recipe)).toEqual(first);
    expect(generatedLetters).not.toEqual(sourcePayload.letters);
    expect(generatedLetters).toEqual(repeatedQuestion.payload.letters);
    expect(generatedLetters).not.toEqual(differentQuestion.payload.letters);
    expect(new Set(generatedLetters).size).toBeGreaterThan(10);
    expect(generatedLetters.filter((letter) => letter === "X").length).toBeLessThan(
      sourcePayload.letters.filter((letter) => letter === "X").length,
    );

    for (const { target, path } of targetPaths) {
      expect(path.map((cell) => generatedLetters[cell]).join("")).toBe(
        path.map((cell) => sourcePayload.letters[cell]).join(""),
      );
      expect(path.map((cell) => generatedLetters[cell]).join("")).toBe(target.word);
    }
    expect(
      isValidWordSearchConfiguration({
        grid: sourcePayload.grid,
        letters: generatedLetters,
        targets: targetPaths.map(({ target, path }) => ({
          ...target,
          startCell: path[0]!,
          endCell: path.at(-1)!,
        })),
      } as never),
    ).toBe(true);
  }
});

it("replays generator v1 word-search recipes with the original X filler", () => {
  const source = bank.find((question) => question.id === "bank-sopa-1")!;
  const template = questionTemplate(source, "flash", [source]);
  const seed = "legacy-word-search";
  const current = generateRehearsal([source], template, seed);
  const legacyRecipe = {
    ...current.recipe,
    generatorVersion: 1 as const,
    sessionId: `rehearsal-${rehearsalHash([
      seed,
      templateHash(template),
      current.recipe.bankRevision,
    ]).slice(0, 32)}`,
  };

  const replayed = replayRehearsal([source], template, legacyRecipe);
  expect(replayed.recipe).toEqual(legacyRecipe);
  expect(replayed.recipe.sessionId).not.toBe(current.recipe.sessionId);
  expect(wordSearchPublicQuestion(replayed).payload.letters).toEqual(
    (source.publicPayload as { letters: string[] }).letters,
  );
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
