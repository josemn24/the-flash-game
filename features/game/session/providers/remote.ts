import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionCommand, GameSessionFailure } from "@/types/contracts/game-session";
import type {
  AuthoritativeSessionUpdate,
  GameSessionAcceptance,
} from "@/types/gameplay/authoritative-session";
import type { AnswerResult } from "@/types/gameplay/result";
import { readTimeTrialProgress } from "@/lib/timeTrial";
import {
  createCompetitiveAttemptClient,
  type CompetitiveAttemptClient,
} from "../../competitive/attemptClient";
import {
  CompetitiveCommandError,
  parseCompetitiveObject,
  type CompetitiveJsonObject,
} from "../../competitive/transport";
import { terminalReviewFromResponse } from "../../serverFlashQuestionAdapter";

const string = (value: unknown) => (typeof value === "string" ? value : undefined);
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const boolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);
const nullableString = (value: unknown) => (value === null ? null : string(value));
const nullableNumber = (value: unknown) => (value === null ? null : number(value));
const strings = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : undefined;
const numbers = (value: unknown) =>
  Array.isArray(value) && value.every((item) => Number.isSafeInteger(item))
    ? (value as number[])
    : undefined;
function answerStatus(value: unknown) {
  if (value === "correct" || value === "partial" || value === "incorrect" || value === "unanswered")
    return value;
  return undefined;
}
function answers(value: unknown): AnswerResult[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item: unknown) => {
    const row = parseCompetitiveObject(item);
    const status = answerStatus(row.status);
    if (!status || typeof row.challengeItemId !== "string")
      throw new CompetitiveCommandError("invalid_json_response", 200);
    return {
      questionId: row.challengeItemId,
      answer: row.answer as AnswerResult["answer"],
      status,
      isCorrect: status === "correct" || status === "partial",
      points: Number(row.points ?? 0),
      timeUsed: Number(row.timeUsedMs ?? 0) / 1000,
      ...(row.resultDetails ? { details: row.resultDetails as AnswerResult["details"] } : {}),
    };
  });
}

/** Select known public fields rather than spreading a transport object into gameplay. */
function publicUpdate(value: CompetitiveJsonObject): AuthoritativeSessionUpdate {
  const resolved = value.resolved ? parseCompetitiveObject(value.resolved) : undefined;
  const cursor = value.narrativeCursor ? parseCompetitiveObject(value.narrativeCursor) : undefined;
  return {
    sessionId: string(value.attemptId),
    revision: number(value.lockVersion),
    ready: boolean(value.ready),
    resumed: boolean(value.resumed),
    phase: string(value.phase),
    status: value.status === "abandoned" ? "abandoned" : answerStatus(value.status),
    challengeItemId: string(value.challengeItemId),
    presentedAt: nullableString(value.presentedAt),
    deadlineAt: nullableString(value.deadlineAt),
    timedOut: boolean(value.timedOut),
    publicPayload: value.publicPayload,
    progress: value.progress,
    answerLength: nullableNumber(value.answerLength),
    timeTrial: value.timeTrial ? readTimeTrialProgress(value.timeTrial) : undefined,
    answers: answers(value.answers),
    resolved:
      resolved && typeof resolved.challengeItemId === "string"
        ? { challengeItemId: resolved.challengeItemId }
        : undefined,
    narrativeCursor: cursor
      ? { currentChallengeItemId: nullableString(cursor.currentChallengeItemId) }
      : undefined,
    score: number(value.score),
    terminalReason: nullableString(value.terminalReason),
    reviewPending: boolean(value.reviewPending),
    terminal: boolean(value.terminal),
    points: number(value.points),
    timeUsedMs: number(value.timeUsedMs),
    details: value.details as AuthoritativeSessionUpdate["details"],
    guess: string(value.guess),
    guesses: strings(value.guesses),
    feedback: Array.isArray(value.feedback)
      ? (value.feedback as AuthoritativeSessionUpdate["feedback"])
      : undefined,
    attemptsUsed: number(value.attemptsUsed),
    code: string(value.code),
    incorrectAttempts: number(value.incorrectAttempts),
    letters: Array.isArray(value.letters)
      ? value.letters.filter(
          (item): item is string | null => item === null || typeof item === "string",
        )
      : undefined,
    correctCells: numbers(value.correctCells),
    movesUsed: number(value.movesUsed),
    movesRemaining: number(value.movesRemaining),
    clue: string(value.clue),
    totalClues: number(value.totalClues),
    cluePenalty: number(value.cluePenalty),
    revealedClues: number(value.revealedClues),
    availablePoints: number(value.availablePoints),
    queens: numbers(value.queens),
    incorrectValidations: number(value.incorrectValidations),
    maxIncorrectValidations: nullableNumber(value.maxIncorrectValidations),
    placedQueens: number(value.placedQueens),
    completedRows: number(value.completedRows),
    completedColumns: number(value.completedColumns),
    completedRegions: number(value.completedRegions),
    conflictingQueens: number(value.conflictingQueens),
    solved: boolean(value.solved),
    foundSelections: Array.isArray(value.foundSelections)
      ? value.foundSelections.filter(
          (item): item is { targetId: string; startCell: number; endCell: number } =>
            item &&
            typeof item === "object" &&
            typeof item.targetId === "string" &&
            Number.isSafeInteger(item.startCell) &&
            Number.isSafeInteger(item.endCell),
        )
      : undefined,
    foundWordIds: strings(value.foundWordIds),
    foundCount: number(value.foundCount),
    totalWords: number(value.totalWords),
    correct: boolean(value.correct),
  };
}

function effect(
  command: GameSessionCommand,
  value: CompetitiveJsonObject,
): GameSessionAcceptance["effect"] {
  if (command.operation === "complete" || value.phase === "results" || value.status === "abandoned")
    return "completed";
  if (command.operation === "answer" || value.terminal === true) return "evaluated";
  if (
    [
      "miniWordleGuess",
      "logicCodeAttempt",
      "wordHashtagSwap",
      "progressiveClueReveal",
      "queensDraft",
      "queensValidation",
      "wordSearchSelection",
    ].includes(command.operation)
  )
    return "progress";
  return "acknowledged";
}

function failure(error: unknown): GameSessionFailure {
  if (!(error instanceof CompetitiveCommandError))
    return { kind: "uncertain", code: "provider_unavailable", retryable: true };
  const retryable =
    error.status === 0 ||
    error.status >= 500 ||
    error.status === 429 ||
    ["invalid_json_response", "alphabet_deadline_not_reached", "time_trial_not_terminal"].includes(
      error.code,
    );
  const attempt = error.details?.attempt;
  const control =
    attempt && typeof attempt === "object" && !Array.isArray(attempt)
      ? (attempt as CompetitiveJsonObject)
      : undefined;
  return {
    kind:
      error.status === 0 || error.status >= 500 || error.code === "invalid_json_response"
        ? "uncertain"
        : "rejected",
    code: error.code,
    retryable,
    retryAfterSeconds:
      error.retryAfterSeconds ??
      (error.status === 429 ||
      ["alphabet_deadline_not_reached", "time_trial_not_terminal"].includes(error.code)
        ? 1
        : undefined),
    authorizationLost: error.status === 401 && error.code !== "attempt_session_missing",
    ...(control &&
    typeof control.attemptId === "string" &&
    Number.isSafeInteger(control.lockVersion) &&
    Number(control.lockVersion) > 0
      ? {
          controlRequired: {
            sessionId: control.attemptId,
            revision: Number(control.lockVersion),
            deadlineAt: nullableString(control.deadlineAt) ?? null,
          },
        }
      : {}),
  };
}

/** Keeps existing endpoints, request bodies, cookies, timeout and idempotency semantics. */
export function createRemoteGameSessionProvider(
  options: { client?: CompetitiveAttemptClient } = {},
): GameSessionProvider {
  return {
    async execute(command, execution) {
      try {
        const client = options.client ?? createCompetitiveAttemptClient(execution?.signal);
        const { input } = command;
        // Rename provider identity/revision only here. Never send neutral metadata as extra wire fields.
        const { sessionId, revision, challengeId, ...data } = input as typeof input & {
          sessionId?: string;
          revision?: number;
          challengeId?: string;
        };
        const wire = {
          ...data,
          ...(sessionId !== undefined ? { attemptId: sessionId, lockVersion: revision } : {}),
          ...(challengeId !== undefined ? { scheduledChallengeId: challengeId } : {}),
        };
        const invoke = client[command.operation] as (
          input: typeof wire,
        ) => Promise<CompetitiveJsonObject>;
        const value = parseCompetitiveObject(await invoke(wire));
        if (
          command.operation !== "prepareSession" &&
          command.operation !== "abandon" &&
          (!Number.isSafeInteger(value.lockVersion) || Number(value.lockVersion) < 1)
        )
          throw new CompetitiveCommandError("invalid_json_response", 200);
        if (
          (command.operation === "start" || command.operation === "takeover") &&
          typeof value.attemptId !== "string"
        )
          throw new CompetitiveCommandError("invalid_json_response", 200);
        const outcome = effect(command, value);
        const state = publicUpdate(value);
        return outcome === "completed"
          ? {
              kind: "accepted",
              effect: outcome,
              state,
              review: terminalReviewFromResponse(value.review),
            }
          : { kind: "accepted", effect: outcome, state };
      } catch (error) {
        return failure(error);
      }
    },
  };
}
