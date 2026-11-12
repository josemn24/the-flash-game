import { pyramidPartialCreditOptions } from "@/lib/gameplay/pyramidPartialCredit";
import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import { getWordSearchPath, isValidWordSearchConfiguration } from "@/lib/wordSearch";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { mechanics } from "./structure-core.mjs";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import { activeQuestions } from "./catalog";
import { compare, exerciseHash, rehearsalHash } from "./hash";
import { RehearsalAssignment } from "./assignment";
export { rehearsalHash } from "./hash";
import type {
  GeneratedRehearsal,
  RehearsalBankQuestion,
  RehearsalCoverage,
  RehearsalDefinition,
  RehearsalRecipe,
  RehearsalTemplate,
} from "@/types/gameplay/rehearsal";
import {
  compileDefinition,
  compileFlashDefinition,
  compileSurvivalDefinition,
  compileAlphabetDefinition,
  compileTimeTrialDefinition,
} from "@/lib/gameplay/localSessionDefinition";

export const GENERATOR_VERSION = 1 as const;
const MAX_WORD_SEARCH_FILL_ATTEMPTS = 64;
const SPANISH_FILLER_LETTERS = [
  ["E", 1678],
  ["A", 1196],
  ["O", 869],
  ["S", 788],
  ["N", 701],
  ["R", 687],
  ["I", 625],
  ["L", 497],
  ["D", 467],
  ["T", 463],
  ["U", 393],
  ["C", 292],
  ["M", 251],
  ["P", 251],
  ["B", 142],
  ["G", 101],
  ["V", 90],
  ["Y", 90],
  ["Q", 88],
  ["H", 70],
  ["F", 69],
  ["Z", 52],
  ["J", 44],
  ["Ñ", 31],
  ["X", 22],
  ["W", 2],
  ["K", 1],
] as const;
const SPANISH_FILLER_WEIGHT_TOTAL = SPANISH_FILLER_LETTERS.reduce(
  (total, [, weight]) => total + weight,
  0,
);
function sessionIdFor(seed: string, templateHashValue: string, bankRevision: string) {
  return `rehearsal-${rehearsalHash([GENERATOR_VERSION, seed, templateHashValue, bankRevision]).slice(0, 32)}`;
}

function fillerLetter(
  seed: string,
  question: RehearsalBankQuestion,
  slotIndex: number,
  attempt: number,
  cellIndex: number,
) {
  const random =
    parseInt(
      rehearsalHash([
        GENERATOR_VERSION,
        "word-search-filler",
        seed,
        question.id,
        question.version,
        slotIndex,
        attempt,
        cellIndex,
      ]).slice(0, 13),
      16,
    ) / 0x10000000000000;
  let cursor = random * SPANISH_FILLER_WEIGHT_TOTAL;
  for (const [letter, weight] of SPANISH_FILLER_LETTERS) {
    cursor -= weight;
    if (cursor < 0) return letter;
  }
  return SPANISH_FILLER_LETTERS.at(-1)![0];
}

function fillWordSearchQuestion(
  question: RehearsalBankQuestion,
  seed: string,
  slotIndex: number,
): RehearsalBankQuestion {
  if (question.type !== "word-search") return question;

  const payload = question.publicPayload as unknown as {
    question: string;
    grid: { rows: number; columns: number };
    letters: string[];
    targets: { id: string; word: string }[];
  };
  const positions = question.solutionPayload.positionsByTargetId as Record<
    string,
    { startCell: number; endCell: number }
  >;
  const targetCells = new Set<number>();
  const validationTargets = payload.targets.map((target) => {
    const position = positions[target.id];
    if (!position) throw new Error("rehearsal_word_search_positions_missing");
    const path = getWordSearchPath(payload.grid, position.startCell, position.endCell);
    if (!path) throw new Error("rehearsal_word_search_positions_invalid");
    path.forEach((cell) => targetCells.add(cell));
    return { ...target, ...position };
  });

  const hasFiller = payload.letters.some(
    (letter, index) => letter === "X" && !targetCells.has(index),
  );
  if (!hasFiller) return question;

  for (let attempt = 0; attempt < MAX_WORD_SEARCH_FILL_ATTEMPTS; attempt += 1) {
    const letters = payload.letters.map((letter, index) =>
      letter === "X" && !targetCells.has(index)
        ? fillerLetter(seed, question, slotIndex, attempt, index)
        : letter,
    );
    if (
      isValidWordSearchConfiguration({
        grid: payload.grid,
        letters,
        targets: validationTargets,
      } as never)
    ) {
      return {
        ...question,
        publicPayload: { ...question.publicPayload, letters },
      };
    }
  }

  throw new Error("rehearsal_word_search_filler_failed");
}

export const questionRef = (q: RehearsalBankQuestion) => ({
  id: q.id,
  version: q.version,
  contentHash: rehearsalHash(q),
});
export function publicMechanics(
  type: RehearsalBankQuestion["type"],
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(mechanics[type](payload)));
}
export function templateHash(template: RehearsalTemplate) {
  return rehearsalHash({
    challengeVersionId: template.challengeVersionId,
    mode: template.mode,
    globalTimeLimitMs: template.globalTimeLimitMs,
    modeConfig: template.modeConfig,
    questions: template.questions,
  });
}
function resolve(q: RehearsalBankQuestion, template: RehearsalTemplate, index: number, id: string) {
  const slot = template.questions[index]!;
  return readStoredQuestion({
    questionType: q.type,
    payloadSchemaVersion: q.payloadSchemaVersion,
    publicPayload: q.publicPayload as JsonValue,
    solutionPayload: q.solutionPayload as JsonValue,
    timeLimitMs: slot.timeLimitMs as DurationMs,
    itemPoints: slot.points,
    receiptId: id,
    questionVersionId: `${q.id}:v${q.version}` as QuestionVersionId,
    mode: template.mode,
    itemConfigSchemaVersion: 1,
    modeConfigSchemaVersion: 1,
    itemConfig: slot.modeConfig as JsonValue,
    modeConfig: template.modeConfig as JsonValue,
    publicRepresentation: "authorized-runtime",
  });
}
function exclusion(q: RehearsalBankQuestion, t: RehearsalTemplate, i: number): string | null {
  const slot = t.questions[i]!;
  if (q.type !== slot.type) return "format";
  if (!q.modes.includes(t.mode)) return "mode";
  if (
    !competitiveCapabilityFor(q.type, t.mode)?.payloadSchemaVersions.includes(
      q.payloadSchemaVersion,
    ) ||
    !competitiveCapabilityFor(slot.type, t.mode)?.payloadSchemaVersions.includes(
      slot.payloadSchemaVersion,
    )
  )
    return "schema";
  if (
    t.mode === "alphabet" &&
    q.alphabetLetter?.normalize("NFC").toLocaleUpperCase("es") !==
      String(slot.modeConfig.letter).normalize("NFC").toLocaleUpperCase("es")
  )
    return "letter";
  try {
    resolve(q, t, i, `candidate:${i}`);
  } catch {
    return "configuration";
  }
  return null;
}
export function rehearsalCandidates(
  bank: readonly RehearsalBankQuestion[],
  template: RehearsalTemplate,
  i: number,
) {
  return activeQuestions(bank).filter((q) => exclusion(q, template, i) === null);
}
export function rehearsalCoverage(
  bank: readonly RehearsalBankQuestion[],
  template: RehearsalTemplate,
): RehearsalCoverage {
  const active = activeQuestions(bank);
  const slots = template.questions.map((slot, i) => {
    const excluded: Record<string, number> = {};
    const candidates = active.filter((q) => {
      const reason = exclusion(q, template, i);
      if (reason) excluded[reason] = (excluded[reason] ?? 0) + 1;
      return !reason;
    });
    const difficulties = { easy: 0, medium: 0, hard: 0 };
    const independentCandidateCount = new Set(candidates.map((q) => q.familyId ?? q.id)).size;
    candidates.forEach((q) => difficulties[q.difficulty]++);
    const repeated = template.questions
      .slice(0, i + 1)
      .filter(
        (q) =>
          q.type === slot.type &&
          (template.mode !== "alphabet" || q.modeConfig.letter === slot.modeConfig.letter),
      ).length;
    return {
      position: i + 1,
      type: slot.type,
      difficulty: slot.difficulty,
      candidateCount: candidates.length,
      independentCandidateCount,
      ...(template.mode === "alphabet" ? { alphabetLetter: String(slot.modeConfig.letter) } : {}),
      difficulties,
      excluded,
      warnings: [
        ...(candidates.length === 0
          ? ["Sin preguntas compatibles"]
          : independentCandidateCount < 3
            ? ["Poca variedad: menos de tres alternativas"]
            : []),
        ...(candidates.length > 0 && !difficulties[slot.difficulty]
          ? ["Se utilizará una dificultad próxima"]
          : []),
        ...(candidates.length > 0 && candidates.length < repeated
          ? ["No hay suficientes ejercicios distintos para estas posiciones"]
          : []),
      ],
    };
  });
  const pools = template.questions.map((_slot, i) => rehearsalCandidates(bank, template, i));
  const requested = template.questions.map((slot) => slot.difficulty);
  const ready =
    slots.length > 0 && Number.isFinite(new RehearsalAssignment(pools, requested).minimumCost());
  const exactDifficultyReady =
    ready &&
    Number.isFinite(
      new RehearsalAssignment(
        pools.map((pool, i) => pool.filter((q) => q.difficulty === requested[i])),
        requested,
      ).minimumCost(),
    );
  return {
    ready,
    exactDifficultyReady,
    slots,
    warnings: !ready
      ? ["No hay suficientes ejercicios distintos compatibles para completar la prueba"]
      : !exactDifficultyReady
        ? ["La combinación requiere sustituir alguna dificultad por una próxima"]
        : [],
  };
}
function similarity(q: RehearsalBankQuestion, expected: Readonly<Record<string, unknown>>) {
  const actual = publicMechanics(q.type, q.publicPayload);
  const keys = Object.keys(expected).filter((k) => actual[k] !== undefined);
  const distance = keys.length
    ? keys.filter((k) => JSON.stringify(actual[k]) !== JSON.stringify(expected[k])).length /
      keys.length
    : 0;
  return 1 / (1 + distance);
}
function choose(bank: readonly RehearsalBankQuestion[], t: RehearsalTemplate, seed: string) {
  const problem = new RehearsalAssignment(
    t.questions.map((_slot, i) => rehearsalCandidates(bank, t, i)),
    t.questions.map((slot) => slot.difficulty),
  );
  let budget = problem.minimumCost();
  if (!t.questions.length || !Number.isFinite(budget))
    throw new Error("rehearsal_coverage_missing");
  const used = new Set<string>();
  const families = new Set<string>();
  function weighted<T>(
    values: readonly T[],
    weight: (value: T) => number,
    index: number,
    stage: string,
  ): T {
    const weights = values.map(weight);
    const random =
      parseInt(
        rehearsalHash([GENERATOR_VERSION, seed, templateHash(t), index, stage]).slice(0, 13),
        16,
      ) / 0x10000000000000;
    let cursor = random * weights.reduce((a, b) => a + b, 0);
    return values.find((_value, i) => (cursor -= weights[i]!) < 0) ?? values[values.length - 1]!;
  }
  return t.questions.map((slot, i) => {
    let pool = problem.slots[i]!.filter((candidate) => {
      if (used.has(candidate.exercise)) return false;
      const remaining = new Set(used).add(candidate.exercise);
      return candidate.cost + problem.minimumCost(i + 1, remaining) === budget;
    });
    const nearest = Math.min(...pool.map((q) => q.cost));
    pool = pool.filter((q) => q.cost === nearest);
    if (pool.some((q) => !families.has(q.question.familyId ?? q.question.id)))
      pool = pool.filter((q) => !families.has(q.question.familyId ?? q.question.id));
    const groups = new Map<string, typeof pool>();
    for (const candidate of pool) {
      const family = candidate.question.familyId ?? candidate.question.id;
      groups.set(family, [...(groups.get(family) ?? []), candidate]);
    }
    const family = weighted(
      [...groups.values()],
      (members) =>
        members.reduce((sum, q) => sum + similarity(q.question, slot.mechanics), 0) /
        members.length,
      i,
      "family",
    );
    const selected = weighted(family, (q) => similarity(q.question, slot.mechanics), i, "question");
    used.add(selected.exercise);
    families.add(selected.question.familyId ?? selected.question.id);
    budget -= selected.cost;
    return selected.question;
  });
}
function materialize(
  t: RehearsalTemplate,
  selected: readonly RehearsalBankQuestion[],
  recipe: RehearsalRecipe,
): GeneratedRehearsal {
  const id = recipe.sessionId;
  const levels = selected.map((q, i) => ({
    challengeItemId: `${id}:${i + 1}`,
    payloadSchemaVersion: q.payloadSchemaVersion,
    ...resolve(fillWordSearchQuestion(q, recipe.seed, i), t, i, `${id}:${i + 1}`),
  }));
  const slots = t.questions.map((s, i) => ({
    id: levels[i]!.challengeItemId,
    position: i + 1,
    questionType: selected[i]!.type,
    payloadSchemaVersion: selected[i]!.payloadSchemaVersion,
    timeLimitMs: s.timeLimitMs,
    points: s.points,
  }));
  const base = {
    id,
    definitionId: t.challengeVersionId,
    number: 1,
    title: t.title,
    subtitle: "Partida de prueba",
    description: "Practica los mismos formatos y reglas con otros ejercicios.",
    maxScore: 100 as const,
  };
  const challenge =
    t.mode === "pyramid"
      ? {
          ...base,
          mode: t.mode,
          attemptVersion: 1,
          ...pyramidPartialCreditOptions(t.modeConfig),
          availableFrom: "1970-01-01T00:00:00.000Z",
          availableUntil: "9999-12-31T23:59:59.999Z",
          levels: slots.map((s, i) => ({
            ...s,
            levelId: `${id}:level:${i + 1}`,
            label: `Nivel ${i + 1}`,
            briefing: {
              title: `Nivel ${i + 1}`,
              format: s.questionType,
              description: "Resuelve esta prueba para continuar el ascenso.",
            },
          })),
        }
      : t.mode === "alphabet"
        ? {
            ...base,
            mode: t.mode,
            timeLimitMs: t.globalTimeLimitMs!,
            entries: slots.map((s, i) => ({
              ...s,
              questionType: "short-text" as const,
              letter: String(t.questions[i]!.modeConfig.letter),
            })),
          }
        : t.mode === "survival"
          ? { ...base, mode: t.mode, slots, lives: Number(t.modeConfig.lives) }
          : t.mode === "time-trial"
            ? {
                ...base,
                mode: t.mode,
                slots,
                timeLimitMs: t.globalTimeLimitMs!,
                ...(t.modeConfig.queensTimeoutPartialCredit === true
                  ? { queensTimeoutPartialCredit: true }
                  : {}),
                ...(t.modeConfig.connectPairsTimeoutPartialCredit === true
                  ? { connectPairsTimeoutPartialCredit: true }
                  : {}),
              }
            : { ...base, mode: t.mode, slots };
  const definition = { challenge, levels } as RehearsalDefinition;
  validateRehearsalDefinition(definition);
  const difficultyFallbacks = selected.flatMap((q, i) =>
    q.difficulty === t.questions[i]!.difficulty
      ? []
      : [
          {
            position: i + 1,
            requested: t.questions[i]!.difficulty,
            selected: q.difficulty,
          },
        ],
  );
  return { definition, recipe, difficultyFallbacks };
}
export function validateRehearsalDefinition(d: RehearsalDefinition) {
  switch (d.challenge.mode) {
    case "pyramid":
      return compileDefinition(d as Parameters<typeof compileDefinition>[0]);
    case "flash":
      return compileFlashDefinition(d as Parameters<typeof compileFlashDefinition>[0]);
    case "survival":
      return compileSurvivalDefinition(d as Parameters<typeof compileSurvivalDefinition>[0]);
    case "alphabet":
      return compileAlphabetDefinition(d as Parameters<typeof compileAlphabetDefinition>[0]);
    case "time-trial":
      return compileTimeTrialDefinition(d as Parameters<typeof compileTimeTrialDefinition>[0]);
  }
}
export function generateRehearsal(
  bank: readonly RehearsalBankQuestion[],
  t: RehearsalTemplate,
  seed: string,
): GeneratedRehearsal {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(seed)) throw new Error("invalid_rehearsal_seed");
  const selected = choose(bank, t, seed);
  const revision = rehearsalHash(
    [...bank].sort((a, b) => compare(a.id, b.id) || a.version - b.version),
  );
  const recipe: RehearsalRecipe = {
    sessionId: sessionIdFor(seed, templateHash(t), revision),
    seed,
    generatorVersion: GENERATOR_VERSION,
    bankRevision: revision,
    templateHash: templateHash(t),
    challengeVersionId: t.challengeVersionId,
    questions: selected.map(questionRef),
  };
  if (new Set(selected.map(exerciseHash)).size !== selected.length)
    throw new Error("rehearsal_recipe_incompatible");
  return materialize(t, selected, recipe);
}
export function replayRehearsal(
  bank: readonly RehearsalBankQuestion[],
  t: RehearsalTemplate,
  recipe: RehearsalRecipe,
): GeneratedRehearsal {
  if (
    !recipe ||
    recipe.generatorVersion !== GENERATOR_VERSION ||
    recipe.challengeVersionId !== t.challengeVersionId ||
    recipe.templateHash !== templateHash(t) ||
    !Array.isArray(recipe.questions) ||
    recipe.questions.length !== t.questions.length ||
    typeof recipe.sessionId !== "string" ||
    !/^rehearsal-[a-f0-9]{32}$/.test(recipe.sessionId) ||
    typeof recipe.seed !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(recipe.seed) ||
    typeof recipe.bankRevision !== "string" ||
    !/^[a-f0-9]{64}$/.test(recipe.bankRevision) ||
    recipe.sessionId !== sessionIdFor(recipe.seed, recipe.templateHash, recipe.bankRevision)
  )
    throw new Error("rehearsal_recipe_incompatible");
  const selected = recipe.questions.map((ref, i) => {
    const q = bank.find((q) => q.id === ref.id && q.version === ref.version);
    if (!q || questionRef(q).contentHash !== ref.contentHash)
      throw new Error("rehearsal_question_missing_or_changed");
    if (exclusion(q, t, i)) throw new Error("rehearsal_recipe_incompatible");
    return q;
  });
  if (new Set(selected.map(exerciseHash)).size !== selected.length)
    throw new Error("rehearsal_recipe_incompatible");
  return materialize(t, selected, recipe);
}
