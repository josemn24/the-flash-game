import type { GameMode } from "@/types/domain/content";
import { resultDetails } from "@/lib/competitiveResponseContract";
import { checkedTimeTrial } from "@/lib/competitiveResponseContract";
import { createSessionResultDecoder, sessionEffect } from "../sessionResult";
import {
  answerRows,
  CompetitiveResponseContractError,
  optionalFields,
  date as validDate,
  boolean as validBoolean,
  text as validText,
  integer as validInteger,
  points as validPoints,
  list as validList,
  nullable as validNullable,
  isRecord,
  oneOf,
  reviewStateValue,
} from "@/lib/competitiveResponseContract";
import type { GameSessionValidationContext } from "@/types/gameplay/authoritative-session";
import { isGameSessionErrorCode } from "@/lib/competitiveErrors";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionFailure } from "@/types/contracts/game-session";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
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
function answers(value: unknown, allowOmittedNullAnswers: boolean): AnswerResult[] | undefined {
  if (value === undefined) return undefined;
  answerRows(value, allowOmittedNullAnswers);
  if (!Array.isArray(value)) return undefined;
  return value.map((item: unknown) => {
    const row = parseCompetitiveObject(item);
    const status = answerStatus(row.status);
    if (!status || typeof row.challengeItemId !== "string")
      throw new CompetitiveCommandError("invalid_json_response", 200);
    return {
      questionId: row.challengeItemId,
      answer: row.answer === undefined ? null : (row.answer as AnswerResult["answer"]),
      status,
      isCorrect: status === "correct" || status === "partial",
      points: row.points as number,
      timeUsed: (row.timeUsedMs as number) / 1000,
      ...(row.resultDetails ? { details: row.resultDetails as AnswerResult["details"] } : {}),
      ...(row.reviewState ? { reviewState: row.reviewState as AnswerResult["reviewState"] } : {}),
    };
  });
}

/** Validate consumed fields before projection can discard a mistyped value. */
function validatePublicFields(value: CompetitiveJsonObject) {
  optionalFields(value, {
    attemptId: validText,
    lockVersion: (v) => validInteger(v) && Number(v) > 0,
    deadlineAt: validNullable(validDate),
    presentedAt: validNullable(validDate),
    terminalReason: validNullable(validText),
    guess: validText,
    code: validText,
    clue: validText,
    solved: validBoolean,
    correct: validBoolean,
    maxIncorrectValidations: validNullable((v) => validInteger(v) && Number(v) > 0),
    status: oneOf(
      "completed",
      "abandoned",
      "in_progress",
      "correct",
      "partial",
      "incorrect",
      "unanswered",
    ),
    passed: oneOf(true),
    ready: oneOf(true),
    resumed: validBoolean,
    timedOut: validBoolean,
    terminal: validBoolean,
    reviewPending: validBoolean,
    score: validNullable(validPoints),
    points: validPoints,
    timeUsedMs: validInteger,
    answerLength: validNullable((v) => validInteger(v) && Number(v) > 0),
    letters: validList(validNullable(validText)),
    feedback: validList(
      (v) => isRecord(v) && validText(v.letter) && oneOf("correct", "present", "absent")(v.status),
    ),
    queens: validList(validInteger),
    correctCells: validList(validInteger),
    guesses: validList(validText),
    foundWordIds: validList(validText),
    foundSelections: validList(
      (v) =>
        isRecord(v) &&
        validText(v.targetId) &&
        validInteger(v.startCell) &&
        validInteger(v.endCell),
    ),
    details: resultDetails,
    reviewState: reviewStateValue,
    resolved: (v) =>
      isRecord(v) &&
      (validText(v.challengeItemId) ||
        (validText(v.attemptId) &&
          validInteger(v.lockVersion) &&
          Number(v.lockVersion) > 0 &&
          validText(v.receiptId) &&
          oneOf("correct", "partial", "incorrect", "unanswered")(v.status) &&
          validPoints(v.points))),
    narrativeCursor: (v) => isRecord(v) && validNullable(validText)(v.currentChallengeItemId),
  });
  for (const key of [
    "attemptsUsed",
    "incorrectAttempts",
    "movesUsed",
    "movesRemaining",
    "totalClues",
    "cluePenalty",
    "revealedClues",
    "availablePoints",
    "incorrectValidations",
    "placedQueens",
    "completedRows",
    "completedColumns",
    "completedRegions",
    "conflictingQueens",
    "foundCount",
    "totalWords",
  ])
    optionalFields(value, { [key]: validInteger });
}

/** Select known public fields rather than spreading a transport object into gameplay. */
function publicUpdate(value: CompetitiveJsonObject, terminal: boolean): AuthoritativeSessionUpdate {
  const resolved = value.resolved ? parseCompetitiveObject(value.resolved) : undefined;
  const cursor = value.narrativeCursor ? parseCompetitiveObject(value.narrativeCursor) : undefined;
  return {
    sessionId: string(value.attemptId),
    revision: number(value.lockVersion),
    ready: boolean(value.ready),
    passed: value.passed === true ? true : undefined,
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
    timeTrial: value.timeTrial
      ? checkedTimeTrial(readTimeTrialProgress, value.timeTrial)
      : undefined,
    answers: answers(value.answers, terminal),
    resolved:
      resolved && typeof resolved.challengeItemId === "string"
        ? { challengeItemId: resolved.challengeItemId }
        : undefined,
    narrativeCursor: cursor
      ? { currentChallengeItemId: nullableString(cursor.currentChallengeItemId) }
      : undefined,
    score: value.status === "abandoned" && value.score === null ? 0 : number(value.score),
    terminalReason: nullableString(value.terminalReason),
    reviewPending: boolean(value.reviewPending),
    terminal: boolean(value.terminal),
    points: number(value.points),
    timeUsedMs: number(value.timeUsedMs),
    details: value.details as AuthoritativeSessionUpdate["details"],
    reviewState: value.reviewState as AuthoritativeSessionUpdate["reviewState"],
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

function failure(error: unknown): GameSessionFailure {
  if (error instanceof CompetitiveResponseContractError) {
    return { kind: "uncertain", code: "invalid_backend_response", retryable: true };
  }
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
    code:
      isGameSessionErrorCode(error.code) && error.code !== "competitive_command_failed"
        ? error.code
        : error.status >= 400 && error.status < 500 && error.status !== 429
          ? "unknown_rejection"
          : error.status === 429
            ? "rate_limited"
            : "command_failed",
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
export function createRemoteGameSessionProvider<M extends GameMode>(options: {
  client?: CompetitiveAttemptClient;
  context: GameSessionValidationContext<M>;
}): GameSessionProvider<M> {
  const decodeResult = createSessionResultDecoder(options.context);
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
        if (command.operation === "complete" || command.operation === "abandon")
          optionalFields(value, { status: oneOf("completed", "abandoned") });
        const outcome = sessionEffect(command.operation, value);
        validatePublicFields(value);
        // An optional wire field may be absent; a malformed value must not disappear in projection.
        if (options.context.mode === "time-trial" && value.timeTrial !== undefined)
          checkedTimeTrial(readTimeTrialProgress, value.timeTrial);
        const state = publicUpdate(value, outcome === "completed");
        let terminalState = outcome === "completed" ? { ...state, phase: "results" } : state;
        // Review is an independent read model. A broken review cannot invalidate completion.
        let review: ReturnType<typeof terminalReviewFromResponse> | undefined;
        if (outcome === "completed") {
          try {
            review = terminalReviewFromResponse(value.review);
            if (
              value.review !== undefined &&
              (!Array.isArray(value.review) || review.length !== value.review.length)
            )
              throw new Error("invalid_review");
          } catch {
            terminalState = { ...terminalState, reviewPending: true };
            review = [];
          }
        }
        return decodeResult(command, {
          kind: "accepted",
          effect: outcome,
          state: terminalState,
          ...(outcome === "completed" ? { review } : {}),
        });
      } catch (error) {
        return failure(error);
      }
    },
  };
}
