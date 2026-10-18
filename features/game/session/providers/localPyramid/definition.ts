import { competitiveCapabilityFor } from "@/lib/question-formats/definitions";
import { readResolvedStoredQuestion } from "@/lib/question-formats/storedRegistry";
import { COMPETITIVE_RESOLVERS } from "@/lib/scoringCore/resolution/registry";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { LocalPyramidDefinition, LocalPyramidLevel } from "@/types/gameplay/local-pyramid";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";
import type { JsonValue, DurationMs } from "@/types/domain/values";

export type CompiledLevel = {
  source: LocalPyramidLevel;
  question: ResolvedQuestion;
  publicPayload: Record<string, unknown>;
  solutionPayload: Record<string, unknown>;
};

/** Only fixture composition calls this projection; public updates never spread a solution. */
export function levelPayloads(level: LocalPyramidLevel) {
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
  const definition = structuredClone(input);
  const { challenge, levels } = definition;
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
  const compiled = challenge.levels.map((slot, index) => {
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
      !competitiveCapabilityFor(slot.questionType, "pyramid")?.payloadSchemaVersions.includes(
        slot.payloadSchemaVersion,
      )
    )
      throw new Error("invalid_local_pyramid_level");
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
      mode: "pyramid",
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
  return { definition, levels: compiled };
}
