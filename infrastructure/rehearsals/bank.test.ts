import { expect, it } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { rehearsalBank } from "./bank";
import originals from "@/test-utils/rehearsals/original-questions.json";
import {
  rehearsalTemplates,
  questionTemplate,
  providerFor,
} from "@/test-utils/rehearsals/fixtures";
import { generateRehearsal, rehearsalCoverage } from "@/lib/rehearsals/generator";
import { validateBank } from "@/lib/rehearsals/bank";
import { SessionDriver, manualClock } from "@/test-utils/game-session-conformance/driver";
import { correctActions } from "@/test-utils/game-session-conformance/corpus";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
const bank = rehearsalBank();
const dictionary = new Map([
  [
    "es-general-5.v1",
    new Set<string>(
      JSON.parse(readFileSync("public/dictionaries/es-general-5.v1.json", "utf8")).words,
    ),
  ],
]);
it("preserves all 78 original questions and solutions", () => {
  expect(originals).toHaveLength(78);
  for (const q of originals) {
    const preserved = bank.find((v) => v.id === q.id && v.version === q.version);
    expect(preserved).toMatchObject(q);
    expect(preserved?.publicPayload).toEqual(q.publicPayload);
    expect(preserved?.solutionPayload).toEqual(q.solutionPayload);
  }
  expect(Object.isFrozen(bank)).toBe(true);
});
it("rejects undeclared modes, duplicate identities, invalid letters and external assets", () => {
  const q = bank[0]!;
  expect(() => validateBank([q, q])).toThrow("metadata");
  expect(() => validateBank([{ ...q, modes: ["alphabet"] }])).toThrow();
  const image = bank.find((q) => q.type === "progressive-image")!;
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
it.each(rehearsalTemplates)(
  "$challengeVersionId has at least three valid alternatives per slot",
  (t) => {
    const coverage = rehearsalCoverage(bank, t);
    expect(coverage.ready).toBe(true);
    for (const slot of coverage.slots)
      expect(
        slot.independentCandidateCount,
        `${t.challengeVersionId}:${slot.position}:${slot.type}`,
      ).toBeGreaterThanOrEqual(3);
  },
);
it("references only available repository resources", () => {
  function visit(value: unknown) {
    if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value)) {
        if (key === "src") expect(existsSync(`public${v}`)).toBe(true);
        else visit(v);
      }
  }
  bank.forEach((q) => visit(q.publicPayload));
});
it.each(bank.flatMap((q) => q.modes.map((mode) => ({ q, mode }))))(
  "$q.id is solvable in $mode using the real provider",
  async ({ q, mode }) => {
    const t = questionTemplate(q, mode, bank);
    const candidates =
      mode === "alphabet"
        ? [q, bank.find((v) => v.type === "short-text" && v.alphabetLetter !== q.alphabetLetter)!]
        : [q];
    const { definition } = generateRehearsal(candidates, t, "bank-conformance");
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
        points: t.questions[i]!.points,
      });
      for (const action of correctActions(question)) await driver.action(action, i);
    }
    const result = await driver.issue("complete");
    expect(result.effect).toBe("completed");
    expect(result.state.score).toBe(100);
  },
);

it("emits the requested structural coverage report", () => {
  if (process.env.REHEARSAL_COVERAGE_REPORT) {
    mkdirSync("output", { recursive: true });
    writeFileSync(
      process.env.REHEARSAL_COVERAGE_REPORT,
      JSON.stringify(
        rehearsalTemplates.map((t) => ({
          challengeVersionId: t.challengeVersionId,
          mode: t.mode,
          ...rehearsalCoverage(bank, t),
        })),
        null,
        2,
      ) + "\n",
    );
  }
});
