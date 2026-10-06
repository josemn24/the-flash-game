import type { AnswerValue } from "@/types/contracts";
import {
  createCompetitiveIdempotencyKey,
  parseCompetitiveObject,
  postCompetitiveJson,
  type CompetitiveJsonObject,
} from "./transport";

type AttemptCommandContext = {
  attemptId: string;
  lockVersion: number;
};

export type CompetitiveAttemptClient = {
  prepareSession: (input: { scheduledChallengeId: string }) => Promise<CompetitiveJsonObject>;
  start: (input: {
    scheduledChallengeId: string;
    idempotencyKey: string;
  }) => Promise<CompetitiveJsonObject>;
  recover: (input: AttemptCommandContext) => Promise<CompetitiveJsonObject>;
  prepare: (
    input: AttemptCommandContext & { idempotencyKey: string },
  ) => Promise<CompetitiveJsonObject>;
  activate: (
    input: AttemptCommandContext & { challengeItemId: string; idempotencyKey: string },
  ) => Promise<CompetitiveJsonObject>;
  answer: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      answer: AnswerValue | null;
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  alphabetPass: (
    input: AttemptCommandContext & { challengeItemId: string; idempotencyKey: string },
  ) => Promise<CompetitiveJsonObject>;
  complete: (
    input: AttemptCommandContext & { idempotencyKey: string },
  ) => Promise<CompetitiveJsonObject>;
  abandon: (input: AttemptCommandContext) => Promise<CompetitiveJsonObject>;
  miniWordleGuess: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      guess: string;
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  logicCodeAttempt: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      code: string;
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  wordHashtagSwap: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      fromCell: number;
      toCell: number;
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  progressiveClueReveal: (
    input: AttemptCommandContext & { challengeItemId: string; idempotencyKey: string },
  ) => Promise<CompetitiveJsonObject>;
  queensDraft: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      queens: readonly number[];
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  queensValidation: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      queens: readonly number[];
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
  wordSearchSelection: (
    input: AttemptCommandContext & {
      challengeItemId: string;
      startCell: number;
      endCell: number;
      idempotencyKey: string;
    },
  ) => Promise<CompetitiveJsonObject>;
};

export function createCompetitiveAttemptClient(signal?: AbortSignal): CompetitiveAttemptClient {
  const post = (path: string, body: object) =>
    postCompetitiveJson(path, body, parseCompetitiveObject, {
      signal,
      timeoutMs: path.endsWith("/complete") ? 10000 : 5000,
    });
  return {
    prepareSession: ({ scheduledChallengeId }) =>
      post("/api/competitive/attempts/session", { scheduledChallengeId }),
    start: ({ scheduledChallengeId, idempotencyKey }) =>
      post("/api/competitive/attempts/start", { scheduledChallengeId, idempotencyKey }),
    recover: ({ attemptId, lockVersion }) =>
      post(`/api/competitive/attempts/${attemptId}/recover`, { lockVersion }),
    prepare: ({ attemptId, lockVersion, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/prepare`, { lockVersion, idempotencyKey }),
    activate: ({ attemptId, lockVersion, challengeItemId, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/activate`, {
        lockVersion,
        challengeItemId,
        idempotencyKey,
      }),
    answer: ({ attemptId, lockVersion, challengeItemId, answer, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/answer`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        answer,
      }),
    alphabetPass: ({ attemptId, lockVersion, challengeItemId, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/alphabet/pass`, {
        lockVersion,
        challengeItemId,
        idempotencyKey,
      }),
    complete: ({ attemptId, lockVersion, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/complete`, { lockVersion, idempotencyKey }),
    abandon: ({ attemptId, lockVersion }) =>
      post(`/api/competitive/attempts/${attemptId}/abandon`, { lockVersion, confirm: true }),
    miniWordleGuess: ({ attemptId, lockVersion, challengeItemId, guess, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/mini-wordle/guess`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        guess,
      }),
    logicCodeAttempt: ({ attemptId, lockVersion, challengeItemId, code, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/logic-code/attempt`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        code,
      }),
    wordHashtagSwap: ({
      attemptId,
      lockVersion,
      challengeItemId,
      fromCell,
      toCell,
      idempotencyKey,
    }) =>
      post(`/api/competitive/attempts/${attemptId}/word-hashtag/swap`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        fromCell,
        toCell,
      }),
    progressiveClueReveal: ({ attemptId, lockVersion, challengeItemId, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/progressive-clues/reveal`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
      }),
    queensDraft: ({ attemptId, lockVersion, challengeItemId, queens, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/queens/draft`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        queens,
      }),
    queensValidation: ({ attemptId, lockVersion, challengeItemId, queens, idempotencyKey }) =>
      post(`/api/competitive/attempts/${attemptId}/queens/validate`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        queens,
      }),
    wordSearchSelection: ({
      attemptId,
      lockVersion,
      challengeItemId,
      startCell,
      endCell,
      idempotencyKey,
    }) =>
      post(`/api/competitive/attempts/${attemptId}/word-search/select`, {
        lockVersion,
        idempotencyKey,
        challengeItemId,
        startCell,
        endCell,
      }),
  };
}

export { createCompetitiveIdempotencyKey };
