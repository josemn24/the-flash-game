import { TABARNIA_CONNECT_PAIRS_TIME_TRIAL } from "../../scripts/fixtures/scenarios/tabarnia-time-trial-connect-pairs.mjs";
import { TABARNIA_QUEENS_TIME_TRIAL } from "../../scripts/fixtures/scenarios/tabarnia-time-trial-queens.mjs";
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
  globalTimeLimitMs = 120_000,
  partialCredit: Pick<
    ServerTimeTrialChallenge,
    "queensTimeoutPartialCredit" | "connectPairsTimeoutPartialCredit"
  > = {},
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
    timeLimitMs: globalTimeLimitMs,
    ...partialCredit,
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
  const questions = TABARNIA_QUEENS_TIME_TRIAL.questions.map((question, index) => ({
    type: question.type,
    points: TABARNIA_QUEENS_TIME_TRIAL.challenge.items[index]!.points,
    timeLimitMs: question.timeLimitMs,
    publicPayload: question.publicPayload,
    solution: question.solutionPayload,
  }));
  return localTimeTrialDefinition(
    "tabarnia-time-trial-queens-01",
    TABARNIA_QUEENS_TIME_TRIAL.challenge.title,
    TABARNIA_QUEENS_TIME_TRIAL.challenge.subtitle,
    questions as TimeTrialFixtureQuestion[],
    TABARNIA_QUEENS_TIME_TRIAL.challenge.globalTimeLimitMs,
  );
}

export function createMockFlashPopTimeTrialConnectPairsDemoDefinition() {
  const questions = TABARNIA_CONNECT_PAIRS_TIME_TRIAL.questions.map((question, index) => ({
    type: question.type,
    points: TABARNIA_CONNECT_PAIRS_TIME_TRIAL.challenge.items[index]!.points,
    timeLimitMs: question.timeLimitMs,
    publicPayload: question.publicPayload,
    solution: question.solutionPayload,
  }));
  return localTimeTrialDefinition(
    "tabarnia-time-trial-connect-pairs-01",
    TABARNIA_CONNECT_PAIRS_TIME_TRIAL.challenge.title,
    TABARNIA_CONNECT_PAIRS_TIME_TRIAL.challenge.subtitle,
    questions as TimeTrialFixtureQuestion[],
    TABARNIA_CONNECT_PAIRS_TIME_TRIAL.challenge.globalTimeLimitMs,
    TABARNIA_CONNECT_PAIRS_TIME_TRIAL.challenge.modeConfig.connectPairsTimeoutPartialCredit
      ? { connectPairsTimeoutPartialCredit: true }
      : {},
  );
}
