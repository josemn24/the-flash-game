import { createHash } from "node:crypto";
import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { mechanics } from "./structure-core.mjs";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { QuestionDifficulty } from "@/types/domain/content";
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
const ranks: Record<QuestionDifficulty, number> = { easy: 0, medium: 1, hard: 2 };
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => compare(a, b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const rehearsalHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
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
function latest(bank: readonly RehearsalBankQuestion[]) {
  const entries = new Map<string, RehearsalBankQuestion>();
  for (const q of bank)
    if (!entries.has(q.id) || entries.get(q.id)!.version < q.version) entries.set(q.id, q);
  return [...entries.values()].sort((a, b) => compare(a.id, b.id));
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
  return latest(bank).filter((q) => exclusion(q, template, i) === null);
}
export function rehearsalCoverage(
  bank: readonly RehearsalBankQuestion[],
  template: RehearsalTemplate,
): RehearsalCoverage {
  const active = latest(bank);
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
          ? ["Puede ser necesario repetir preguntas"]
          : []),
      ],
    };
  });
  return { ready: slots.length > 0 && slots.every((s) => s.candidateCount > 0), slots };
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
  const cycles = new Map<string, Set<string>>(),
    families = new Set<string>();
  return t.questions.map((slot, i) => {
    const bucket = `${slot.type}:${t.mode === "alphabet" ? String(slot.modeConfig.letter) : ""}`;
    const used = cycles.get(bucket) ?? new Set<string>();
    cycles.set(bucket, used);
    let pool = rehearsalCandidates(bank, t, i);
    if (!pool.length) throw new Error("rehearsal_coverage_missing");
    if (!pool.some((q) => !used.has(q.id))) used.clear();
    pool = pool.filter((q) => !used.has(q.id));
    const best = Math.min(
      ...pool.map((q) => Math.abs(ranks[q.difficulty] - ranks[slot.difficulty])),
    );
    pool = pool.filter((q) => Math.abs(ranks[q.difficulty] - ranks[slot.difficulty]) === best);
    const easier = Math.min(...pool.map((q) => ranks[q.difficulty]));
    pool = pool.filter((q) => ranks[q.difficulty] === easier);
    if (pool.some((q) => !families.has(q.familyId ?? q.id)))
      pool = pool.filter((q) => !families.has(q.familyId ?? q.id));
    const weights = pool.map((q) => similarity(q, slot.mechanics));
    const random =
      parseInt(rehearsalHash([GENERATOR_VERSION, seed, templateHash(t), i]).slice(0, 13), 16) /
      0x10000000000000;
    let cursor = random * weights.reduce((a, b) => a + b, 0);
    const q = pool.find((_q, j) => (cursor -= weights[j]!) < 0) ?? pool[pool.length - 1]!;
    used.add(q.id);
    families.add(q.familyId ?? q.id);
    return q;
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
    ...resolve(q, t, i, `${id}:${i + 1}`),
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
            ? { ...base, mode: t.mode, slots, timeLimitMs: t.globalTimeLimitMs! }
            : { ...base, mode: t.mode, slots };
  const definition = { challenge, levels } as RehearsalDefinition;
  validateRehearsalDefinition(definition);
  return { definition, recipe };
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
    sessionId: `rehearsal-${rehearsalHash([seed, templateHash(t), revision]).slice(0, 32)}`,
    seed,
    generatorVersion: GENERATOR_VERSION,
    bankRevision: revision,
    templateHash: templateHash(t),
    challengeVersionId: t.challengeVersionId,
    questions: selected.map(questionRef),
  };
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
    recipe.sessionId !==
      `rehearsal-${rehearsalHash([recipe.seed, recipe.templateHash, recipe.bankRevision]).slice(0, 32)}`
  )
    throw new Error("rehearsal_recipe_incompatible");
  const selected = recipe.questions.map((ref, i) => {
    const q = bank.find((q) => q.id === ref.id && q.version === ref.version);
    if (!q || questionRef(q).contentHash !== ref.contentHash)
      throw new Error("rehearsal_question_missing_or_changed");
    if (exclusion(q, t, i)) throw new Error("rehearsal_recipe_incompatible");
    return q;
  });
  return materialize(t, selected, recipe);
}
