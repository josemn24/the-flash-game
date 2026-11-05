import {
  timeTrialConnectPairsQuestions,
  timeTrialQueensQuestions,
} from "@/data/mock/timeTrialFixtures.mjs";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { TimeTrialFormat } from "@/types/domain/time-trial";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";

/** The same technical questions seed SQL and exercise the local authority. Demos stay independent. */
export function createTimeTrialTestDefinition({
  format = "queens",
  challengeId = `test-time-trial-${format}`,
  itemIds,
  globalTimeLimitMs = 120_000,
}: {
  format?: TimeTrialFormat;
  challengeId?: string;
  itemIds?: readonly string[];
  globalTimeLimitMs?: number;
} = {}): LocalTimeTrialDefinition {
  const questions = format === "queens" ? timeTrialQueensQuestions : timeTrialConnectPairsQuestions;
  const ids = itemIds ?? questions.map((_, index) => `${challengeId}-item-${index + 1}`);
  if (
    ids.length !== questions.length ||
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("time_trial_test_item_ids_mismatch");

  const levels = questions.map((question, index) => ({
    challengeItemId: ids[index]!,
    payloadSchemaVersion: 1,
    ...readStoredQuestion({
      questionType: format,
      payloadSchemaVersion: 1,
      publicPayload: question.publicPayload as JsonValue,
      solutionPayload: question.solution as JsonValue,
      timeLimitMs: question.timeLimitMs as DurationMs,
      itemPoints: question.points,
      receiptId: ids[index]!,
      questionVersionId: `${challengeId}-question-${index + 1}` as QuestionVersionId,
      mode: "time-trial",
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
      publicRepresentation: "authorized-runtime",
    }),
  }));

  return {
    challenge: {
      id: challengeId,
      definitionId: `${challengeId}-definition`,
      number: 1,
      title: format === "queens" ? "Contrarreloj Queens" : "Contrarreloj Conectar parejas",
      subtitle: "Fixture técnico de dos tableros",
      description: "Definición compartida por las pruebas del proveedor y la conformidad HTTP.",
      mode: "time-trial",
      timeLimitMs: globalTimeLimitMs,
      maxScore: 100,
      slots: questions.map((question, index) => ({
        id: ids[index]!,
        position: index + 1,
        questionType: format,
        payloadSchemaVersion: 1,
        timeLimitMs: question.timeLimitMs,
        points: question.points,
      })),
    },
    levels,
  };
}
