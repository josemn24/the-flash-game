import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import { readResolvedStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type {
  LocalFlashDefinition,
  LocalQuestionLevel,
  LocalPyramidDefinition,
  LocalSurvivalDefinition,
} from "@/types/gameplay/local-pyramid";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";
import type { JsonValue, DurationMs } from "@/types/domain/values";

export type CompiledLevel = {
  source: LocalQuestionLevel;
  question: ResolvedQuestion;
  publicPayload: Record<string, unknown>;
  solutionPayload: Record<string, unknown>;
};

/** Only fixture composition calls this projection; public updates never spread a solution. */
export function levelPayloads(level: LocalQuestionLevel) {
  const { publicQuestion: question, solution } = level;
  const publicPayload: Record<string, unknown> = {
    ...(question.category ? { category: question.category } : {}),
    tags: question.tags,
    question: question.prompt,
    ...(question.context === null ? {} : { context: question.context }),
    ...(question.payload ?? {}),
  };
  if (question.type === "progressive-clues") {
    delete publicPayload.clueCount;
    publicPayload.clues = (level.reveals ?? [])
      .filter((r) => r.type === "progressive-clues")
      .sort((a, b) => a.payload.clueIndex - b.payload.clueIndex)
      .map((r) => r.payload.clue);
  }
  if (question.type === "escape") {
    for (const key of ["instruction", "objectiveLabel", "completionMessage", "boardLabel"])
      if (publicPayload[key] === null) delete publicPayload[key];
  }
  return {
    publicPayload,
    solutionPayload: {
      ...(solution.payload ?? {}),
      ...(solution.explanation ? { explanation: solution.explanation } : {}),
    },
  };
}

export function compileDefinition(input: LocalPyramidDefinition): {
  definition: LocalPyramidDefinition;
  levels: CompiledLevel[];
} {
  const { challenge, levels } = input;
  if (
    challenge.mode !== "pyramid" ||
    !challenge.id ||
    !Number.isFinite(Date.parse(challenge.availableFrom)) ||
    !Number.isFinite(Date.parse(challenge.availableUntil)) ||
    Date.parse(challenge.availableFrom) >= Date.parse(challenge.availableUntil) ||
    challenge.levels.length !== 7 ||
    levels.length !== 7 ||
    challenge.maxScore !== 100 ||
    challenge.levels.reduce((sum, slot) => sum + slot.points, 0) !== 100 ||
    new Set(challenge.levels.map((slot) => slot.id)).size !== 7 ||
    new Set(levels.map((level) => level.challengeItemId)).size !== 7
  )
    throw new Error("invalid_local_pyramid_definition");
  const compiled = compileLocalQuestions(structuredClone(input));
  return { definition: structuredClone(input), levels: compiled };
}

export function compileFlashDefinition(input: LocalFlashDefinition): {
  definition: LocalFlashDefinition;
  levels: CompiledLevel[];
} {
  return compileSequentialDefinition(input, "flash");
}

export function compileSurvivalDefinition(input: LocalSurvivalDefinition): {
  definition: LocalSurvivalDefinition;
  levels: CompiledLevel[];
} {
  return compileSequentialDefinition(input, "survival");
}

export function compileTimeTrialDefinition(input: LocalTimeTrialDefinition): {
  definition: LocalTimeTrialDefinition;
  levels: CompiledLevel[];
} {
  const definition = structuredClone(input);
  const { challenge, levels } = definition;
  const slots = challenge.slots;
  const format = slots[0]?.questionType;
  if (
    challenge.mode !== "time-trial" ||
    !challenge.id ||
    !Number.isSafeInteger(challenge.timeLimitMs) ||
    challenge.timeLimitMs <= 0 ||
    challenge.timeLimitMs % 1000 !== 0 ||
    slots.length < 2 ||
    slots.length > 20 ||
    slots.length !== levels.length ||
    challenge.maxScore !== 100 ||
    slots.reduce((sum, slot) => sum + slot.points, 0) !== 100 ||
    slots.some(
      (slot) =>
        !Number.isSafeInteger(slot.points) ||
        slot.points <= 0 ||
        !["queens", "connect-pairs"].includes(slot.questionType) ||
        slot.questionType !== format ||
        levels.find((level) => level.challengeItemId === slot.id)?.payloadSchemaVersion !==
          slot.payloadSchemaVersion,
    ) ||
    new Set(slots.map((slot) => slot.id)).size !== slots.length ||
    new Set(levels.map((level) => level.challengeItemId)).size !== levels.length ||
    slots.some((slot, index) => levels[index]?.challengeItemId !== slot.id)
  )
    throw new Error("invalid_local_time_trial_definition");
  const compiled = compileLocalQuestions(definition);
  return {
    definition,
    levels: compiled.map((level) => {
      const tags = level.publicPayload.tags;
      const hasTags =
        tags !== null &&
        typeof tags === "object" &&
        Object.values(tags).some((value) => Array.isArray(value) && value.length > 0);
      if (hasTags) return level;
      const publicPayload = { ...level.publicPayload };
      delete publicPayload.tags;
      return { ...level, publicPayload };
    }),
  };
}

export function compileAlphabetDefinition(input: LocalAlphabetDefinition): {
  definition: LocalAlphabetDefinition;
  levels: CompiledLevel[];
} {
  const definition = structuredClone(input);
  const { challenge, levels } = definition;
  const entries = challenge.entries;
  if (
    challenge.mode !== "alphabet" ||
    !challenge.id ||
    !Number.isSafeInteger(challenge.timeLimitMs) ||
    challenge.timeLimitMs <= 0 ||
    entries.length < 2 ||
    entries.length > 20 ||
    entries.length !== levels.length ||
    challenge.maxScore !== 100 ||
    entries.reduce((sum, entry) => sum + entry.points, 0) !== challenge.maxScore ||
    entries.some(
      (entry, index) =>
        !entry.letter.trim() ||
        !Number.isSafeInteger(entry.points) ||
        entry.points <= 0 ||
        entry.questionType !== "short-text" ||
        entry.position !== index + 1 ||
        levels[index]?.challengeItemId !== entry.id ||
        levels[index]?.payloadSchemaVersion !== entry.payloadSchemaVersion,
    ) ||
    new Set(entries.map((entry) => entry.id)).size !== entries.length ||
    new Set(entries.map((entry) => entry.letter.toLocaleUpperCase("es"))).size !== entries.length
  )
    throw new Error("invalid_local_alphabet_definition");
  const compiled = compileLocalQuestions(definition);
  return {
    definition,
    levels: compiled.map((level) => {
      const tags = level.publicPayload.tags;
      const hasTags =
        tags !== null &&
        typeof tags === "object" &&
        Object.values(tags).some((value) => Array.isArray(value) && value.length > 0);
      if (hasTags) return level;
      const publicPayload = { ...level.publicPayload };
      delete publicPayload.tags;
      return { ...level, publicPayload };
    }),
  };
}

function compileSequentialDefinition<T extends LocalFlashDefinition | LocalSurvivalDefinition>(
  input: T,
  mode: "flash" | "survival",
): { definition: T; levels: CompiledLevel[] } {
  const definition = structuredClone(input);
  const { challenge, levels } = definition;
  if (
    challenge.mode !== mode ||
    !challenge.id ||
    !challenge.slots.length ||
    challenge.slots.length !== levels.length ||
    challenge.maxScore !== challenge.slots.reduce((sum, slot) => sum + slot.points, 0) ||
    new Set(challenge.slots.map((slot) => slot.id)).size !== challenge.slots.length ||
    new Set(levels.map((level) => level.challengeItemId)).size !== levels.length ||
    (challenge.mode === "survival" &&
      (!Number.isSafeInteger(challenge.lives) ||
        challenge.lives < 1 ||
        challenge.lives > challenge.slots.length))
  )
    throw new Error(`invalid_local_${mode}_definition`);
  return { definition, levels: compileLocalQuestions(definition) };
}

function compileLocalQuestions(
  input:
    | LocalPyramidDefinition
    | LocalFlashDefinition
    | LocalSurvivalDefinition
    | LocalTimeTrialDefinition
    | LocalAlphabetDefinition,
): CompiledLevel[] {
  const { challenge, levels } = input;
  const mode = challenge.mode;
  const slots =
    challenge.mode === "pyramid"
      ? challenge.levels
      : challenge.mode === "alphabet"
        ? challenge.entries
        : challenge.slots;
  return slots.map((slot, index) => {
    const level = levels.find((row) => row.challengeItemId === slot.id);
    if (
      !level ||
      slot.position !== index + 1 ||
      !Number.isSafeInteger(slot.points) ||
      slot.points <= 0 ||
      level.publicQuestion.type !== slot.questionType ||
      level.solution.type !== slot.questionType ||
      level.publicQuestion.id !== level.solution.questionVersionId ||
      level.publicQuestion.timeLimitMs !== slot.timeLimitMs ||
      level.payloadSchemaVersion !== slot.payloadSchemaVersion ||
      !competitiveCapabilityFor(slot.questionType, mode)?.payloadSchemaVersions.includes(
        slot.payloadSchemaVersion,
      )
    )
      throw new Error(`invalid_local_${mode}_level`);
    if (level.publicQuestion.type === "progressive-clues") {
      const reveals = level.reveals ?? [];
      if (
        reveals.length !== level.publicQuestion.payload.clueCount ||
        reveals.some(
          (reveal, index) =>
            reveal.type !== "progressive-clues" ||
            reveal.questionVersionId !== level.publicQuestion.id ||
            reveal.payload.clueIndex !== index,
        )
      )
        throw new Error("invalid_local_pyramid_reveals");
    }
    const payloads = levelPayloads(level);
    // Reuse the publication validators as well as canonical resolution. No local-only format whitelist.
    readResolvedStoredQuestion({
      questionType: slot.questionType,
      payloadSchemaVersion: slot.payloadSchemaVersion,
      publicPayload: payloads.publicPayload as JsonValue,
      solutionPayload: payloads.solutionPayload as JsonValue,
      publicRepresentation: "authorized-runtime",
      timeLimitMs: slot.timeLimitMs as DurationMs,
      itemPoints: slot.points,
      receiptId: slot.id,
      mode,
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
    });
    const resolved = COMPETITIVE_RESOLVERS[slot.questionType as CompetitiveQuestionType]({
      publicQuestion: level.publicQuestion,
      solution: level.solution,
      points: slot.points,
      reveals: level.reveals,
    });
    // The legacy matching API projects an absent category as JSON null. Publication
    // validation above still receives its original optional metadata representation.
    if (slot.questionType === "matching" && !level.publicQuestion.category)
      payloads.publicPayload.category = null;
    return { source: level, question: { ...resolved, id: slot.id }, ...payloads };
  });
}
