import { expect, it } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { rehearsalBank } from "./bank";
import history from "@/test-utils/rehearsals/history-fingerprints.json";
import {
  rehearsalTemplates,
  bankQuestionCase,
  providerFor,
} from "@/test-utils/rehearsals/fixtures";
import {
  generateRehearsal,
  rehearsalCoverage,
  rehearsalHash,
  questionRef,
} from "@/lib/rehearsals/generator";
import { activeQuestions, activeQuality, genericExplanation } from "@/lib/rehearsals/catalog";
import { auditRehearsalBank } from "@/lib/rehearsals/audit";
import { exerciseHash } from "@/lib/rehearsals/hash";
import { validateBank } from "@/lib/rehearsals/bank";
import { SessionDriver, manualClock } from "@/test-utils/game-session-conformance/driver";
import { correctActions } from "@/test-utils/game-session-conformance/corpus";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { GeneratedRehearsal, RehearsalMode } from "@/types/gameplay/rehearsal";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
const bank = rehearsalBank();
const active = activeQuestions(bank);
const dictionary = new Map([
  [
    "es-general-5.v1",
    new Set<string>(
      JSON.parse(readFileSync("public/dictionaries/es-general-5.v1.json", "utf8")).words,
    ),
  ],
]);

it("protects the consolidated baseline and every subsequently registered version", () => {
  expect(history.length).toBeGreaterThanOrEqual(232);
  expect(history.slice(0, 232).every((ref) => ref.version === 1)).toBe(true);
  expect(new Set(history.slice(0, 232).map((ref) => ref.id)).size).toBe(232);
  expect(bank).toHaveLength(history.length);
  for (const ref of history) {
    const preserved = bank.find((q) => q.id === ref.id && q.version === ref.version);
    expect(preserved, ref.id).toBeDefined();
    expect(rehearsalHash(preserved), ref.id).toBe(ref.contentHash);
  }
  expect(Object.isFrozen(bank)).toBe(true);
});

it("rejects invalid metadata and current duplicate exercises while allowing archived copies", () => {
  const q = active[0]!;
  expect(() => validateBank([q, q])).toThrow("metadata");
  expect(() => validateBank([{ ...q, modes: ["alphabet"], alphabetLetter: "!" }])).toThrow();
  expect(() => validateBank([{ ...q, generationStatus: "bad" as "active" }])).toThrow("metadata");
  const duplicate = {
    ...q,
    id: "copy",
    solutionPayload: {
      ...q.solutionPayload,
      explanation: "A different explanation does not create a new exercise.",
    },
  };
  expect(() => validateBank([q, duplicate])).toThrow("duplicate_bank_exercise");
  expect(() =>
    validateBank([
      q,
      duplicate,
      { ...duplicate, version: duplicate.version + 1, generationStatus: "retired" },
    ]),
  ).not.toThrow();
  const image = active.find((q) => q.type === "progressive-image")!;
  expect(() =>
    validateBank([
      {
        ...image,
        publicPayload: {
          ...image.publicPayload,
          surface: { src: "https://example.com/asset.png" },
        },
      },
    ]),
  ).toThrow("asset");
});

it("keeps the connect-pairs bank at sixteen boards across the intended difficulty spread", () => {
  const connectPairs = active.filter((question) => question.type === "connect-pairs");
  expect(connectPairs).toHaveLength(16);
  expect(connectPairs.filter((question) => question.difficulty === "easy")).toHaveLength(4);
  expect(connectPairs.filter((question) => question.difficulty === "medium")).toHaveLength(7);
  expect(connectPairs.filter((question) => question.difficulty === "hard")).toHaveLength(5);
  expect(connectPairs.some((question) => question.id === "bank-parejas-cumbre-anterior")).toBe(
    true,
  );
});

it("has specific explanations and complete capability-derived letter/difficulty coverage", () => {
  expect(activeQuality(bank)).toEqual({ duplicates: [], genericExplanations: [] });
  const audit = auditRehearsalBank(bank);
  expect(audit.ready).toBe(true);
  expect(audit.combinations.filter((c) => c.mode === "alphabet")).toHaveLength(27 * 3);
  for (const c of audit.combinations)
    expect(c.familyCount, JSON.stringify(c)).toBeGreaterThanOrEqual(c.mode === "alphabet" ? 3 : 1);
  for (const phrase of [
    "",
    "La solución de este ejercicio permite revisar cómo funciona el formato.",
    "Resuelve el ejercicio siguiendo sus reglas y comprueba la solución.",
    "  LA SOLUCION de este ejercicio permite revisar como funciona el formato!  ",
    "Isla es la respuesta descrita.",
  ])
    expect(genericExplanation(phrase)).toBe(true);
});

it("rejects missing same-difficulty alphabet variety even when other difficulties remain", () => {
  const alternatives = active.filter((q) => q.alphabetLetter === "Ñ" && q.difficulty === "medium");
  const depleted = bank.filter((q) => q.id !== alternatives[0]!.id);
  expect(auditRehearsalBank(depleted).ready).toBe(false);
  const related = bank.map((q) =>
    q.id === alternatives[0]!.id
      ? { ...q, familyId: alternatives[1]!.familyId ?? alternatives[1]!.id }
      : q,
  );
  expect(auditRehearsalBank(related).ready).toBe(false);
});

it.each(rehearsalTemplates)(
  "$challengeVersionId has a full distinct assignment and three families per slot",
  (t) => {
    const coverage = rehearsalCoverage(bank, t);
    expect(coverage.ready).toBe(true);
    for (const slot of coverage.slots)
      expect(
        slot.independentCandidateCount,
        `${t.challengeVersionId}:${slot.position}`,
      ).toBeGreaterThanOrEqual(3);
    const run = generateRehearsal(bank, t, "structural-coverage");
    const questions = run.recipe.questions.map((ref) =>
      bank.find((q) => q.id === ref.id && q.version === ref.version)!,
    );
    expect(new Set(questions.map(exerciseHash)).size).toBe(t.questions.length);
    if (coverage.exactDifficultyReady) expect(run.difficultyFallbacks).toEqual([]);
  },
);

it("references only available repository resources", () => {
  function visit(value: unknown) {
    if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value)) {
        if (key === "src") expect(existsSync(`public${v}`), String(v)).toBe(true);
        else visit(v);
      }
  }
  bank.forEach((q) => visit(q.publicPayload));
});

async function solve(run: GeneratedRehearsal, mode: RehearsalMode) {
  const { definition } = run;
  const driver = new SessionDriver(
    providerFor(definition, manualClock(), dictionary),
    definition.challenge.id,
    definition.levels.map((l) => l.challengeItemId),
  );
  await driver.begin();
  for (const [i, level] of definition.levels.entries()) {
    await driver.issue("prepare", {}, i);
    if (mode === "pyramid") await driver.issue("activate", {}, i);
    const question = COMPETITIVE_RESOLVERS[level.publicQuestion.type as CompetitiveQuestionType]({
      ...level,
      points: 100,
    });
    for (const action of correctActions(question)) await driver.action(action, i);
  }
  const result = await driver.issue("complete");
  expect(result.effect).toBe("completed");
  expect(result.state.score).toBe(100);
}

it.each(active.flatMap((q) => q.modes.map((mode) => ({ q, mode }))))(
  "active $q.id is generated and solved in $mode",
  async ({ q, mode }) => {
    const fixture = bankQuestionCase(q, mode, bank);
    const run = generateRehearsal(fixture.bank, fixture.template, "bank-conformance");
    expect(run.recipe.questions).toContainEqual(questionRef(q));
    await solve(run, mode);
  },
);

it.each(
  active
    .filter((q) => q.type === "progressive-clues")
    .flatMap((q) => q.modes.map((mode) => ({ q, mode }))),
)(
  "$q.id reveals its authored clues in order and applies their penalty in $mode",
  async ({ q, mode }) => {
    const fixture = bankQuestionCase(q, mode, bank);
    const { definition } = generateRehearsal(fixture.bank, fixture.template, "bank-clue-reveals");
    const driver = new SessionDriver(
      providerFor(definition, manualClock(), dictionary),
      definition.challenge.id,
      definition.levels.map((level) => level.challengeItemId),
    );
    const clues = q.publicPayload.clues as string[];
    const points = fixture.template.questions[0]!.points;
    const penalty = Math.max(1, Math.round((Number(q.publicPayload.cluePenalty) * points) / 100));
    await driver.begin();
    const initial = await driver.issue("prepare");
    for (const hidden of clues.slice(1)) expect(JSON.stringify(initial)).not.toContain(hidden);
    if (mode === "pyramid") await driver.issue("activate");
    for (let index = 1; index < clues.length; index++) {
      const revealed = await driver.issue("progressiveClueReveal");
      expect(revealed.state).toMatchObject({
        clue: clues[index],
        clues: clues.slice(0, index + 1),
        revealedClues: index + 1,
        totalClues: clues.length,
        cluePenalty: penalty,
        availablePoints: Math.max(0, points - penalty * index),
      });
      for (const hidden of clues.slice(index + 1))
        expect(JSON.stringify(revealed)).not.toContain(hidden);
    }
    expect(await driver.execute(driver.command("progressiveClueReveal"))).toMatchObject({
      code: "all_clues_revealed",
    });
    const answer = (q.solutionPayload.acceptedAnswers as string[]).at(-1)!;
    const answered = await driver.issue("answer", { answer });
    expect(answered.state).toMatchObject({
      status: "correct",
      points: Math.max(0, points - penalty * (clues.length - 1)),
    });
  },
);

it("emits the consolidated bank audit, matrix coverage and actual fallbacks", () => {
  if (!process.env.REHEARSAL_COVERAGE_REPORT) return;
  mkdirSync("output", { recursive: true });
  writeFileSync(
    process.env.REHEARSAL_COVERAGE_REPORT,
    JSON.stringify(
      {
        ...auditRehearsalBank(bank),
        templates: rehearsalTemplates.map((t) => ({
          challengeVersionId: t.challengeVersionId,
          mode: t.mode,
          ...rehearsalCoverage(bank, t),
          difficultyFallbacks: generateRehearsal(bank, t, "coverage-report").difficultyFallbacks,
        })),
      },
      null,
      2,
    ) + "\n",
  );
});
