import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rehearsalBank } from "@/infrastructure/rehearsals/bank";
import { bankQuestionCase, rehearsalTemplates } from "@/test-utils/rehearsals/fixtures";
import { getWordSearchPath, isValidWordSearchConfiguration } from "@/lib/wordSearch";
import { activeQuestions } from "./catalog";
import { REHEARSAL_DIFFICULTIES, REHEARSAL_LETTERS } from "./audit";
import { exerciseHash, rehearsalHash } from "./hash";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
import {
  generateRehearsal,
  rehearsalCoverage,
  replayRehearsal,
  rehearsalCandidates,
} from "./generator";
import type {
  GeneratedRehearsal,
  RehearsalBankQuestion,
  RehearsalTemplate,
} from "@/types/gameplay/rehearsal";
const bank = rehearsalBank();
const active = activeQuestions(bank);
const t = rehearsalTemplates.find((t) => t.mode === "time-trial")!;
const two = {
  ...t,
  questions: t.questions.slice(0, 2).map((q) => ({ ...q, points: 50, mechanics: {} })),
};
const base = active.find((q) => q.type === "queens")!;
function choice(
  id: string,
  difficulty: RehearsalBankQuestion["difficulty"] = "medium",
  familyId = id,
): RehearsalBankQuestion {
  return {
    ...base,
    id,
    difficulty,
    familyId,
    publicPayload: { ...base.publicPayload, question: id },
  };
}
const chosen = (run: GeneratedRehearsal, pool: readonly RehearsalBankQuestion[]) =>
  run.recipe.questions.map((ref) =>
    pool.find((q) => q.id === ref.id && q.version === ref.version)!,
  );

it("is deterministic, independent of bank order, and varies by seed", () => {
  const before = JSON.stringify({ bank, t });
  const a = generateRehearsal(bank, t, "seed");
  expect(a.recipe.generatorVersion).toBe(1);
  expect(generateRehearsal([...bank].reverse(), t, "seed")).toEqual(a);
  expect(generateRehearsal(bank, t, "seed")).toEqual(a);
  expect(replayRehearsal(bank, t, a.recipe)).toEqual(a);
  expect(
    new Set(
      Array.from({ length: 12 }, (_, i) =>
        JSON.stringify(generateRehearsal(bank, t, `seed-${i}`).recipe.questions),
      ),
    ).size,
  ).toBeGreaterThan(1);
  expect(new Set(chosen(a, bank).map(exerciseHash)).size).toBe(t.questions.length);
  expect(JSON.stringify({ bank, t })).toBe(before);
});

it.each(REHEARSAL_DIFFICULTIES)(
  "varies every alphabet letter across seeds at %s difficulty while retaining its structure",
  (difficulty) => {
    const base = rehearsalTemplates.find((template) => template.mode === "alphabet")!;
    // An alphabet session supports at most 20 letters, so exercise the full bank in two rounds.
    for (const letters of [REHEARSAL_LETTERS.slice(0, 14), REHEARSAL_LETTERS.slice(14)]) {
      const template: RehearsalTemplate = {
        ...base,
        questions: letters.map((letter, index) => ({
          ...base.questions[0]!,
          difficulty,
          points: Math.floor(100 / letters.length) + (index < 100 % letters.length ? 1 : 0),
          modeConfig: { letter },
        })),
      };
      const seen = letters.map(() => new Set<string>());
      for (let seed = 0; seed < 12; seed++) {
        const run = generateRehearsal(bank, template, `alphabet-variety-${seed}`);
        expect(run.difficultyFallbacks).toEqual([]);
        expect(run.definition.challenge.mode).toBe("alphabet");
        if (run.definition.challenge.mode !== "alphabet") throw new Error("alphabet expected");
        expect(run.definition.challenge.entries.map((entry) => entry.letter)).toEqual(letters);
        chosen(run, bank).forEach((question, index) => {
          expect(question.difficulty).toBe(difficulty);
          expect(question.alphabetLetter).toBe(letters[index]);
          seen[index]!.add(String(question.solutionPayload.correctAnswer));
        });
      }
      seen.forEach((answers, index) => expect(answers.size, letters[index]).toBeGreaterThan(1));
    }
  },
);

it.each(
  rehearsalTemplates.filter((template) =>
    template.questions.some((question) => question.type === "multiple-choice"),
  ),
)(
  "$challengeVersionId keeps repeated multiple-choice difficulty and varies the exercise set",
  (template) => {
    const sets = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const run = generateRehearsal(bank, template, `multiple-choice-variety-${seed}`);
      const questions = chosen(run, bank);
      const choices = questions.filter((question, index) => {
        if (template.questions[index]!.type !== "multiple-choice") return false;
        expect(question.difficulty).toBe(template.questions[index]!.difficulty);
        return true;
      });
      expect(new Set(choices.map(exerciseHash)).size).toBe(choices.length);
      expect(new Set(choices.map((question) => question.familyId ?? question.id)).size).toBe(
        choices.length,
      );
      expect(
        run.difficultyFallbacks.filter(
          (fallback) => template.questions[fallback.position - 1]!.type === "multiple-choice",
        ),
      ).toEqual([]);
      // Compare sorted IDs so that merely reordering the same exercises cannot count as variety.
      sets.add(JSON.stringify(choices.map((question) => question.id).sort()));
      expect(replayRehearsal(bank, template, run.recipe)).toEqual(run);
    }
    expect(sets.size).toBeGreaterThan(1);
  },
);

it.each([
  { format: "connect-pairs", minimumMedium: 4 },
  { format: "queens", minimumMedium: 5 },
] as const)(
  "maximizes exact $format difficulty in a six-board trial and varies its exercise set",
  ({ format, minimumMedium }) => {
    const template = rehearsalTemplates.find(
      (candidate) =>
        candidate.mode === "time-trial" &&
        candidate.questions.every((question) => question.type === format),
    )!;
    const candidates = rehearsalCandidates(bank, template, 0);
    const medium = candidates.filter((question) => question.difficulty === "medium");
    expect(medium.length).toBeGreaterThanOrEqual(minimumMedium);
    const exactCount = Math.min(template.questions.length, medium.length);
    const coverage = rehearsalCoverage(bank, template);
    expect(coverage.ready).toBe(true);
    expect(coverage.exactDifficultyReady).toBe(exactCount === template.questions.length);
    const sets = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const run = generateRehearsal(bank, template, `${format}-variety-${seed}`);
      const selected = chosen(run, bank);
      expect(selected.every((question) => question.type === format)).toBe(true);
      expect(new Set(selected.map(exerciseHash)).size).toBe(template.questions.length);
      expect(new Set(selected.map((question) => question.familyId ?? question.id)).size).toBe(
        template.questions.length,
      );
      expect(selected.filter((question) => question.difficulty === "medium")).toHaveLength(
        exactCount,
      );
      expect(run.difficultyFallbacks).toHaveLength(template.questions.length - exactCount);
      expect(
        run.difficultyFallbacks.every(
          (fallback) => fallback.requested === "medium" && fallback.selected === "easy",
        ),
      ).toBe(true);
      sets.add(JSON.stringify(selected.map((question) => question.id).sort()));
      expect(replayRehearsal(bank, template, run.recipe)).toEqual(run);
    }
    expect(sets.size).toBeGreaterThan(1);
  },
);

it("fills every active word search deterministically without changing the target paths", () => {
  for (const source of active.filter((q) => q.type === "word-search")) {
    const fixture = bankQuestionCase(source, "flash", bank);
    const seed = `filler-${source.id}`;
    const run = generateRehearsal(fixture.bank, fixture.template, seed);
    const same = generateRehearsal(fixture.bank, fixture.template, seed);
    const other = generateRehearsal(fixture.bank, fixture.template, `other-${source.id}`);
    expect(same).toEqual(run);
    expect(replayRehearsal(bank, fixture.template, run.recipe)).toEqual(run);
    const first = run.definition.levels[0]!.publicQuestion;
    const different = other.definition.levels[0]!.publicQuestion;
    if (first.type !== "word-search" || different.type !== "word-search")
      throw new Error("word-search expected");
    expect(first.payload.letters).not.toEqual(source.publicPayload.letters);
    expect(first.payload.letters).not.toEqual(different.payload.letters);
    const positions = source.solutionPayload.positionsByTargetId as Record<
      string,
      { startCell: number; endCell: number }
    >;
    const targets = first.payload.targets.map((target) => ({
      ...target,
      ...positions[target.id]!,
    }));
    for (const target of targets) {
      const path = getWordSearchPath(first.payload.grid, target.startCell, target.endCell)!;
      expect(path.map((cell) => first.payload.letters[cell]).join("")).toBe(target.word);
    }
    expect(
      isValidWordSearchConfiguration(
        COMPETITIVE_RESOLVERS["word-search"]({ ...run.definition.levels[0]!, points: 100 }),
      ),
    ).toBe(true);
  }
});

type FrozenRun = {
  template: RehearsalTemplate;
  recipe: GeneratedRehearsal["recipe"];
  definitionHash: string;
};
const frozen = JSON.parse(
  readFileSync("test-utils/rehearsals/v1-recipes.json", "utf8"),
) as FrozenRun[];
it.each(frozen)(
  "replays the consolidated v1 reference for $template.challengeVersionId unchanged",
  (fixture) => {
    const run = replayRehearsal(bank, fixture.template, fixture.recipe);
    expect(run.recipe).toEqual(fixture.recipe);
    expect(rehearsalHash(run.definition)).toBe(fixture.definitionHash);
  },
);

it("uses nearby difficulty only after exhausting distinct exact candidates and reports it", () => {
  const pool = [choice("easy", "easy"), choice("medium"), choice("hard", "hard")];
  const coverage = rehearsalCoverage(pool, two);
  expect(coverage.ready).toBe(true);
  expect(coverage.exactDifficultyReady).toBe(false);
  expect(coverage.warnings).toHaveLength(1);
  const run = generateRehearsal(pool, two, "fallback");
  expect(run.recipe.questions.map((q) => q.id)).toEqual(["medium", "easy"]);
  expect(run.difficultyFallbacks).toEqual([{ position: 2, requested: "medium", selected: "easy" }]);
});
it("uses the lower nearby difficulty on equal distance", () => {
  const pool = [choice("easy", "easy"), choice("hard", "hard")];
  expect(generateRehearsal(pool, two, "tie").recipe.questions.map((q) => q.id)).toEqual([
    "easy",
    "hard",
  ]);
});
it("never repeats identical content even when its IDs, explanations and metadata differ", () => {
  const first = choice("first");
  const duplicate = {
    ...first,
    id: "second",
    familyId: "another-family",
    difficulty: "hard" as const,
    solutionPayload: { ...first.solutionPayload, explanation: "Otra explicación." },
  };
  expect(exerciseHash(first)).toBe(exerciseHash(duplicate));
  expect(rehearsalCoverage([first, duplicate], two).ready).toBe(false);
  expect(() => generateRehearsal([first, duplicate], two, "duplicates")).toThrow("coverage");
});
it("detects shared shortages even when every slot has multiple candidates", () => {
  const pool = [choice("first"), choice("second")];
  expect(rehearsalCoverage(pool, t).slots.every((s) => s.candidateCount === 2)).toBe(true);
  expect(rehearsalCoverage(pool, t).ready).toBe(false);
  expect(() => generateRehearsal(pool, t, "insufficient")).toThrow("coverage");
});
it("reserves the only fast-compatible image instead of stranding a later slot", () => {
  const source = active.find(
    (q) => q.type === "progressive-image" && q.payloadSchemaVersion === 2,
  )!;
  const fast = {
    ...source,
    id: "fast",
    difficulty: "medium" as const,
    publicPayload: { ...source.publicPayload, question: "fast", revealDurationMs: 2000 },
  };
  const slow = {
    ...source,
    id: "slow",
    difficulty: "medium" as const,
    publicPayload: { ...source.publicPayload, question: "slow", revealDurationMs: 8000 },
  };
  const fixture = bankQuestionCase(source, "flash", bank).template;
  const template = {
    ...fixture,
    questions: [10000, 5000].map((timeLimitMs) => ({
      ...fixture.questions[0]!,
      timeLimitMs,
      points: 50,
      difficulty: "medium" as const,
    })),
  };
  expect(rehearsalCoverage([fast, slow], template).exactDifficultyReady).toBe(true);
  for (let i = 0; i < 12; i++)
    expect(
      generateRehearsal([fast, slow], template, `reserve-${i}`).recipe.questions.map((q) => q.id),
    ).toEqual(["slow", "fast"]);
});
it("keeps exact difficulty globally when an alternative would force an avoidable fallback", () => {
  const source = active.find(
    (q) => q.type === "progressive-image" && q.payloadSchemaVersion === 2,
  )!;
  const pool = [
    {
      ...source,
      id: "fast-medium",
      difficulty: "medium" as const,
      publicPayload: { ...source.publicPayload, question: "fast", revealDurationMs: 2000 },
    },
    {
      ...source,
      id: "slow-medium",
      difficulty: "medium" as const,
      publicPayload: { ...source.publicPayload, question: "slow", revealDurationMs: 8000 },
    },
    {
      ...source,
      id: "fast-easy",
      difficulty: "easy" as const,
      publicPayload: { ...source.publicPayload, question: "easy", revealDurationMs: 2000 },
    },
  ];
  const sample = bankQuestionCase(source, "flash", bank).template;
  const template = {
    ...sample,
    questions: [10000, 5000].map((timeLimitMs) => ({
      ...sample.questions[0]!,
      timeLimitMs,
      points: 50,
      difficulty: "medium" as const,
    })),
  };
  for (let i = 0; i < 12; i++)
    expect(generateRehearsal(pool, template, `exact-${i}`).difficultyFallbacks).toEqual([]);
});
it("weights families independently of their number of variants and allows distinct variants", () => {
  const small = [choice("a0", "medium", "a"), choice("b0", "medium", "b")];
  const large = [
    ...small,
    ...Array.from({ length: 8 }, (_, i) => choice(`a${i + 1}`, "medium", "a")),
  ];
  const families = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const a = chosen(generateRehearsal(small, two, `family-${i}`), small);
    const b = chosen(generateRehearsal(large, two, `family-${i}`), large);
    expect(a[0]!.familyId).toBe(b[0]!.familyId);
    expect(a[0]!.familyId).not.toBe(a[1]!.familyId);
    families.add(a[0]!.familyId!);
  }
  expect(families.size).toBe(2);
  const variants = large.filter((q) => q.familyId === "a");
  expect(generateRehearsal(variants, two, "variants").recipe.questions[0]!.id).not.toBe(
    generateRehearsal(variants, two, "variants").recipe.questions[1]!.id,
  );
});
it("supports future editorial versions and retirements without losing new v1 recipes", () => {
  const originalPool = [choice("first"), choice("second")];
  const original = generateRehearsal(originalPool, two, "before");
  const updated = [...originalPool, { ...originalPool[0]!, version: originalPool[0]!.version + 1 }];
  expect(
    generateRehearsal(updated, two, "after").recipe.questions.find((q) => q.id === "first")!
      .version,
  ).toBe(originalPool[0]!.version + 1);
  expect(replayRehearsal(updated, two, original.recipe)).toEqual(original);
  const retired = [
    ...updated,
    {
      ...originalPool[0]!,
      version: originalPool[0]!.version + 2,
      generationStatus: "retired" as const,
    },
  ];
  expect(rehearsalCandidates(retired, two, 0).map((q) => q.id)).toEqual(["second"]);
  expect(rehearsalCoverage(retired, two).ready).toBe(false);
  expect(replayRehearsal(retired, two, original.recipe)).toEqual(original);
});
it("rejects damaged, changed and unsupported recipes", () => {
  const pool = [choice("first"), choice("second")];
  const run = generateRehearsal(pool, two, "receipt");
  for (const generatorVersion of [0, 2, 3]) {
    const unsupported = { ...JSON.parse(JSON.stringify(run.recipe)), generatorVersion };
    expect(() => replayRehearsal(pool, two, unsupported)).toThrow("incompatible");
  }
  const oldV1 = {
    ...run.recipe,
    sessionId: `rehearsal-${rehearsalHash([run.recipe.seed, run.recipe.templateHash, run.recipe.bankRevision]).slice(0, 32)}`,
  };
  expect(() => replayRehearsal(pool, two, oldV1)).toThrow("incompatible");
  expect(() => replayRehearsal(pool, two, { ...run.recipe, templateHash: "wrong" })).toThrow(
    "incompatible",
  );
  expect(() => replayRehearsal(pool, two, { ...run.recipe, seed: "altered" })).toThrow(
    "incompatible",
  );
  expect(() =>
    replayRehearsal(
      pool.map((q) => ({ ...q, difficulty: "hard" })),
      two,
      run.recipe,
    ),
  ).toThrow("changed");
  expect(() =>
    replayRehearsal(pool, two, {
      ...run.recipe,
      questions: [run.recipe.questions[0]!, run.recipe.questions[0]!],
    }),
  ).toThrow("incompatible");
});
it("requires letter, declared mode, supported schema and valid official timing", () => {
  const alphabet = rehearsalTemplates.find((t) => t.mode === "alphabet")!;
  const letter = rehearsalCandidates(bank, alphabet, 0)[0]!;
  expect(rehearsalCandidates([{ ...letter, alphabetLetter: "Ñ" }], alphabet, 0)).toEqual([]);
  expect(rehearsalCandidates([{ ...letter, payloadSchemaVersion: 999 }], alphabet, 0)).toEqual([]);
  expect(rehearsalCandidates([{ ...letter, modes: ["flash"] }], alphabet, 0)).toEqual([]);
  expect(rehearsalCoverage([], t).ready).toBe(false);
  expect(() => generateRehearsal([], t, "empty")).toThrow("coverage");
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
