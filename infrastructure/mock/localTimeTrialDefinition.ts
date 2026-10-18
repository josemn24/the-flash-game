import {
  timeTrialConnectPairsQuestions,
  timeTrialQueensQuestions,
} from "@/data/mock/timeTrialFixtures.mjs";
import { readStoredQuestion } from "@/lib/question-formats/storedRegistry";
import type { QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue } from "@/types/domain/values";
import type { ServerTimeTrialChallenge } from "@/types/gameplay/challenge";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";

type TimeTrialFixtureQuestion = {
  readonly type: "queens" | "connect-pairs";
  readonly points: number;
  readonly timeLimitMs: number;
  readonly publicPayload: Record<string, unknown>;
  readonly solution: Record<string, unknown>;
};

function localTimeTrialDefinition(
  id: string,
  title: string,
  subtitle: string,
  questions: readonly TimeTrialFixtureQuestion[],
): LocalTimeTrialDefinition {
  const levels = questions.map((question, index) => {
    const challengeItemId = `${id}-item-${index + 1}`;
    const questionVersionId = `${id}-question-${index + 1}` as QuestionVersionId;
    const resolved = readStoredQuestion({
      questionType: question.type,
      payloadSchemaVersion: 1,
      publicPayload: question.publicPayload as JsonValue,
      solutionPayload: question.solution as JsonValue,
      timeLimitMs: question.timeLimitMs as DurationMs,
      itemPoints: question.points,
      receiptId: challengeItemId,
      questionVersionId,
      mode: "time-trial",
      itemConfigSchemaVersion: 1,
      modeConfigSchemaVersion: 1,
      itemConfig: {},
      modeConfig: {},
      publicRepresentation: "authorized-runtime",
    });
    return { ...resolved, challengeItemId, payloadSchemaVersion: 1 };
  });

  const challenge: ServerTimeTrialChallenge = {
    id,
    definitionId: `${id}-definition`,
    number: 1,
    title,
    subtitle,
    description: "Ensayo local con el mismo flujo de una partida competitiva.",
    mode: "time-trial",
    timeLimitMs: 120_000,
    maxScore: 100,
    slots: questions.map((question, index) => ({
      id: levels[index]!.challengeItemId,
      position: index + 1,
      questionType: question.type,
      payloadSchemaVersion: 1,
      timeLimitMs: question.timeLimitMs,
      points: question.points,
    })),
  };
  return { challenge, levels };
}

export function createMockFlashPopTimeTrialQueensDemoDefinition() {
  return localTimeTrialDefinition(
    "tabarnia-time-trial-queens-01",
    "Contrarreloj Queens",
    "Resuelve dos tableros con un único reloj global.",
    timeTrialQueensQuestions as TimeTrialFixtureQuestion[],
  );
}

export function createMockFlashPopTimeTrialConnectPairsDemoDefinition() {
  return localTimeTrialDefinition(
    "tabarnia-time-trial-connect-pairs-01",
    "Contrarreloj Conectar parejas",
    "Cubre dos tableros de distinto tamaño con un único reloj global.",
    timeTrialConnectPairsQuestions as TimeTrialFixtureQuestion[],
  );
}
