import { createSessionResultDecoder, sessionValidationContext } from "../sessionResult";
import type { GameSessionFailure } from "@/types/contracts/game-session";
type LocalSessionResult =
  import("@/types/gameplay/authoritative-session").SessionResultDraft | GameSessionFailure;
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { AnswerValue } from "@/types/contracts";
import type { DurationMs, UtcIsoDateTime } from "@/types/domain/values";
import type { TimeTrialEndReason, TimeTrialProgress } from "@/types/domain/time-trial";
import type {
  AuthoritativeSessionUpdate,
  SessionResultDraft,
} from "@/types/gameplay/authoritative-session";
import type { AnswerResult, AnswerResultDetails } from "@/types/gameplay/result";
import type { LocalTimeTrialDefinition } from "@/types/gameplay/local-time-trial";
import { evaluateCompetitiveReceipt } from "@/lib/scoringCore/competitiveReceipt";
import { connectPairsCompletedRouteMetrics } from "@/lib/connectPairs";
import { randomUuid } from "@/lib/randomUuid";
import { systemSessionClock } from "../clock";
import { compileTimeTrialDefinition } from "./localShared/definition";
import {
  formatProgress,
  formatReviewState,
  initialFormatState,
  LocalRejection,
  reject,
  transitionFormat,
} from "./localShared/formats";
import { createLocalCommandQueue, localCommandSignature } from "./localShared/runtime";

export type LocalTimeTrialOptions = {
  readonly definition: LocalTimeTrialDefinition;
  readonly clock?: SessionClock;
  readonly createSessionId?: () => string;
};

type ActiveBoard = { readonly index: number; readonly presentedAt: number };
type PendingAnswer = {
  readonly index: number;
  readonly answer: AnswerValue | null;
  readonly timeUsedMs: number;
  readonly timedOut: boolean;
};
type CachedCommand = { readonly signature: string; readonly result: LocalSessionResult };

const iso = (time: number | null): UtcIsoDateTime | null =>
  time === null ? null : (new Date(time).toISOString() as UtcIsoDateTime);

/** Local Time Trial authority; one deadline governs every board in the run. */
export function createLocalTimeTrialSessionProvider(
  options: LocalTimeTrialOptions,
): GameSessionProvider<"time-trial"> {
  const { definition, levels } = compileTimeTrialDefinition(options.definition);
  const { challenge } = definition;
  const clock = options.clock ?? systemSessionClock;
  const formats = levels.map(initialFormatState);
  const cache = new Map<string, CachedCommand>();
  const enqueue = createLocalCommandQueue();
  const answers: AnswerResult[] = [];
  let sessionId: string | undefined;
  let revision = 0;
  let status: "new" | "in_progress" | "completed" | "abandoned" = "new";
  let clockStartedAt: number | null = null;
  let deadlineAt: number | null = null;
  let active: ActiveBoard | null = null;
  let lastCorrectAt: number | null = null;
  let terminalAt: number | null = null;
  let forcedEndReason: TimeTrialEndReason | null = null;

  const solvedCount = () => answers.filter((answer) => answer.status === "correct").length;
  const score = () => answers.reduce((sum, answer) => sum + answer.points, 0);
  const endReason = (now: number): TimeTrialEndReason | null => {
    if (forcedEndReason) return forcedEndReason;
    if (answers.length === challenge.slots.length && solvedCount() === challenge.slots.length)
      return "all_solved";
    if (answers.some((answer) => answer.status === "incorrect")) return "validation_limit";
    if (deadlineAt !== null && now >= deadlineAt) return "time_limit";
    if (answers.some((answer) => answer.status !== "correct")) return "recovery_interrupted";
    return null;
  };
  const progress = (now: number): TimeTrialProgress => {
    const reason = endReason(now);
    const start = clockStartedAt;
    const finish =
      reason === "all_solved"
        ? lastCorrectAt
        : reason === "time_limit"
          ? deadlineAt
          : reason
            ? terminalAt
            : Math.min(now, deadlineAt ?? now);
    const elapsedTimeMs =
      start === null || finish === null ? 0 : Math.max(0, Math.floor(finish - start));
    return {
      kind: "time-trial",
      currentIndex: Math.min(solvedCount(), challenge.slots.length - 1),
      solvedCount: solvedCount(),
      totalCount: challenge.slots.length,
      points: score(),
      elapsedTimeMs,
      clockStartedAt: iso(start) as UtcIsoDateTime | null,
      deadlineAt: iso(deadlineAt) as UtcIsoDateTime | null,
      serverNow: iso(now) as UtcIsoDateTime,
      lastCorrectElapsedMs:
        start === null || lastCorrectAt === null
          ? null
          : Math.max(0, Math.floor(lastCorrectAt - start)),
      endReason: reason,
    };
  };
  const terminalReview = () =>
    answers.map((answer) => {
      const level = levels.find(
        (candidate) => candidate.source.challengeItemId === answer.questionId,
      )!;
      return {
        challengeItemId: answer.questionId,
        publicPayload: level.publicPayload,
        solutionPayload: level.solutionPayload,
      };
    });
  const accept = (
    effect: SessionResultDraft["effect"],
    state: AuthoritativeSessionUpdate,
  ): SessionResultDraft =>
    effect === "completed"
      ? { kind: "accepted", effect, state, review: terminalReview() }
      : { kind: "accepted", effect, state };
  const terminal = (now: number): SessionResultDraft =>
    accept("completed", {
      sessionId,
      revision,
      phase: "results",
      ...(status === "abandoned" ? { status: "abandoned" as const } : {}),
      score: status === "abandoned" ? 0 : score(),
      answers: [...answers],
      terminalReason: status === "abandoned" ? null : endReason(now),
      timeTrial: progress(now),
    });
  const answerTime = (board: ActiveBoard, now: number) =>
    Math.floor(Math.max(0, Math.min(now, deadlineAt ?? now) - board.presentedAt));
  const reviewLevel = (index: number) => levels[index]!;
  const evaluate = (pending: PendingAnswer, now: number) => {
    const level = reviewLevel(pending.index);
    const state = formats[pending.index]!;
    const effective =
      level.question.type === "queens" ? { queens: state.queens, marks: [] } : pending.answer;
    const reviewState = pending.timedOut ? formatReviewState(level, state) : undefined;
    const checkpoint =
      reviewState?.type === "queens"
        ? { queens: [...reviewState.queens], marks: [] }
        : reviewState?.type === "connect-pairs"
          ? {
              paths: Object.fromEntries(
                Object.entries(reviewState.paths).map(([id, path]) => [id, [...path]]),
              ),
            }
          : null;
    const evaluated = evaluateCompetitiveReceipt({
      question: level.question,
      answer: pending.timedOut ? checkpoint : effective,
      receipt: {
        timeUsedMs: pending.timeUsedMs as DurationMs,
        timedOut: pending.timedOut && checkpoint === null,
      },
      // Keep attempt details for review; the Time Trial policy below awards
      // the full editorial weight and never applies the Queens penalty.
      incorrectAttempts: formats[pending.index]!.incorrectValidations,
    });
    const correct =
      level.question.type === "queens"
        ? evaluated.details?.type === "queens" && evaluated.details.solved
        : evaluated.status === "correct";
    const weight = challenge.slots[pending.index]!.points;
    let points = correct ? weight : 0;
    let details: AnswerResultDetails | undefined = pending.timedOut ? undefined : evaluated.details;
    if (
      !correct &&
      challenge.queensTimeoutPartialCredit &&
      reviewState?.type === "queens" &&
      level.question.type === "queens"
    ) {
      const { grid, solution, prefilledQueens = [] } = level.question;
      const required = grid.rows - prefilledQueens.length;
      const placedCorrectly = new Set(
        reviewState.queens.filter(
          (cell) => solution.includes(cell) && !prefilledQueens.includes(cell),
        ),
      ).size;
      if (required > 0)
        points = Math.min(weight - 1, Math.floor((weight * placedCorrectly) / required));
    } else if (
      !correct &&
      challenge.connectPairsTimeoutPartialCredit &&
      reviewState?.type === "connect-pairs" &&
      level.question.type === "connect-pairs"
    ) {
      const metrics = connectPairsCompletedRouteMetrics(level.question, reviewState.paths);
      const { connectedPairs, totalPairs, coveredCells, totalCells } = metrics;
      points = Math.min(
        weight - 1,
        Math.floor((weight * connectedPairs) / totalPairs),
        Math.floor((weight * coveredCells) / totalCells),
      );
      details = {
        type: "connect-pairs",
        timeoutPartialCredit: true,
        ...metrics,
        coverage: coveredCells / totalCells,
        conflicts: 0,
      };
    }
    const result: AnswerResult = {
      questionId: level.source.challengeItemId,
      answer: pending.timedOut ? null : effective,
      status: correct
        ? "correct"
        : pending.timedOut
          ? points > 0
            ? "partial"
            : "unanswered"
          : "incorrect",
      isCorrect: correct,
      points,
      timeUsed: pending.timeUsedMs / 1000,
      ...(details ? { details } : {}),
      ...(reviewState ? { reviewState } : {}),
    };
    answers.push(result);
    if (result.status === "correct") lastCorrectAt = now;
    else terminalAt = now;
    active = null;
    revision++;
    return { level, result };
  };
  const evaluationAcceptance = (
    pending: PendingAnswer,
    now: number,
    formatUpdate: AuthoritativeSessionUpdate = {},
  ) => {
    const { level, result } = evaluate(pending, now);
    return accept("evaluated", {
      ...formatUpdate,
      sessionId,
      challengeItemId: level.source.challengeItemId,
      revision,
      status: result.status,
      points: result.points,
      timeUsedMs: pending.timeUsedMs,
      timedOut: pending.timedOut,
      ...(result.details ? { details: result.details } : {}),
      timeTrial: progress(now),
    });
  };
  const preparedUpdate = (index: number, now: number): AuthoritativeSessionUpdate => {
    const level = levels[index]!;
    const timedOut = deadlineAt !== null && now >= deadlineAt;
    return {
      sessionId,
      revision,
      challengeItemId: level.source.challengeItemId,
      publicPayload: timedOut ? null : structuredClone(level.publicPayload),
      progress: formatProgress(level, formats[index]!),
      presentedAt: iso(active?.presentedAt ?? null),
      deadlineAt: iso(deadlineAt),
      timedOut,
      timeTrial: progress(now),
    };
  };
  const finish = (now: number, abandoned = false): SessionResultDraft => {
    if (!abandoned && endReason(now) === null) return reject("time_trial_not_terminal");
    if (abandoned && !endReason(now)) forcedEndReason = "recovery_interrupted";
    status = abandoned ? "abandoned" : "completed";
    active = null;
    terminalAt ??= now;
    revision++;
    return terminal(now);
  };

  const run = async (
    command: GameSessionCommand,
    signal?: AbortSignal,
    receivedAt = clock.now(),
  ): Promise<LocalSessionResult> => {
    const cancelled = (): LocalSessionResult => ({
      kind: "uncertain",
      code: "request_cancelled",
      retryable: true,
    });
    if (signal?.aborted) return cancelled();
    const now = receivedAt;
    const { operation, input } = command;
    if (operation === "takeover" || operation === "alphabetPass" || operation === "activate")
      return reject("invalid_command");
    const key = "idempotencyKey" in input ? input.idempotencyKey : undefined;
    const signature = localCommandSignature(command);
    const cached = key ? cache.get(key) : undefined;
    if (cached)
      return cached.signature === signature ? cached.result : reject("idempotency_conflict");
    if ("challengeId" in input && input.challengeId !== challenge.id)
      return reject("invalid_command");
    if (operation === "prepareSession") return accept("acknowledged", { ready: true });

    if (operation === "start") {
      if (status === "completed" || status === "abandoned") return reject("attempt_terminal");
      const resumed = status === "in_progress";
      if (!resumed) {
        sessionId = (options.createSessionId ?? randomUuid)();
        status = "in_progress";
        revision = 1;
        // Competitive Time Trial starts its authoritative clock when the first
        // board is prepared, after the shared countdown has completed.
        clockStartedAt = null;
        deadlineAt = null;
      }
      const result = accept("acknowledged", {
        sessionId,
        revision,
        resumed,
        deadlineAt: iso(deadlineAt),
        timeTrial: progress(now),
      });
      if (key) cache.set(key, { signature, result });
      return result;
    }

    if (!("sessionId" in input) || input.sessionId !== sessionId) return reject("not_authorized");
    if (operation === "recover" && (status === "completed" || status === "abandoned"))
      return terminal(now);
    if (operation === "complete" && (status === "completed" || status === "abandoned"))
      return terminal(now);
    if (input.revision !== revision) return reject("stale_version");
    if (status !== "in_progress") return reject("attempt_terminal");
    if (operation === "abandon") {
      const result = finish(now, true);
      return result;
    }

    const deadline = deadlineAt;
    const deadlineReached = deadline !== null && now >= deadline;
    let result: LocalSessionResult;
    if (operation === "complete" || (operation === "recover" && deadlineReached)) {
      if (deadlineReached && active) {
        evaluate(
          {
            index: active.index,
            answer: null,
            timeUsedMs: answerTime(active, now),
            timedOut: true,
          },
          deadline,
        );
      }
      result = finish(now);
    } else if (operation === "recover") {
      if (active) {
        result = accept("acknowledged", {
          ...preparedUpdate(active.index, now),
          phase: "playing",
        });
      } else {
        result = accept("acknowledged", {
          sessionId,
          revision,
          phase: "briefing",
          answers: [...answers],
          timeTrial: progress(now),
        });
      }
    } else if (operation === "prepare") {
      const index = active?.index ?? answers.length;
      const level = levels[index];
      if (!level) return reject("no_pending_item");
      if (deadlineAt === null) {
        clockStartedAt = now;
        deadlineAt = now + challenge.timeLimitMs;
      }
      if (!active && now < (deadlineAt ?? 0)) active = { index, presentedAt: now };
      revision++;
      result = accept("acknowledged", preparedUpdate(index, now));
    } else {
      if (!("challengeItemId" in input)) return reject("invalid_command");
      const board = active;
      if (!board || levels[board.index]?.source.challengeItemId !== input.challengeItemId)
        return reject("interaction_not_presented");
      if (deadlineAt !== null && now >= deadlineAt) return reject("deadline_reached");
      const level = levels[board.index]!;
      if (
        operation === "queensDraft" ||
        operation === "queensValidation" ||
        operation === "connectPairsDraft"
      ) {
        const transition = transitionFormat(level, formats[board.index]!, command, new Map());
        formats[board.index] = transition.state;
        revision++;
        if (transition.terminal) {
          const pending = {
            index: board.index,
            answer: transition.answer,
            timeUsedMs: answerTime(board, now),
            timedOut: false,
          } satisfies PendingAnswer;
          result = evaluationAcceptance(pending, now, transition.update);
        } else {
          result = accept("progress", {
            ...transition.update,
            sessionId,
            challengeItemId: level.source.challengeItemId,
            revision,
            timeTrial: progress(now),
          });
        }
      } else if (operation === "answer") {
        if (input.answer === null) return reject("invalid_answer");
        const pending = {
          index: board.index,
          answer: structuredClone(input.answer),
          timeUsedMs: answerTime(board, now),
          timedOut: false,
        } satisfies PendingAnswer;
        result = evaluationAcceptance(pending, now);
      } else {
        return reject("unsupported_question");
      }
    }

    if (signal?.aborted) return cancelled();
    if (key) cache.set(key, { signature, result });
    return result;
  };

  const decodeResult = createSessionResultDecoder(sessionValidationContext(challenge));
  return {
    execute(command, execution) {
      const captured = structuredClone(command);
      const receivedAt = clock.now();
      return enqueue(async () => {
        try {
          const result = structuredClone(await run(captured, execution?.signal, receivedAt));
          // Cached facts retain their timestamps; replay refreshes only the display reference.
          if (result.kind === "accepted" && result.state.timeTrial)
            return decodeResult(command, {
              ...result,
              state: {
                ...result.state,
                timeTrial: { ...result.state.timeTrial, serverNow: iso(clock.now())! },
              },
            });
          return decodeResult(command, result);
        } catch (error) {
          if (error instanceof LocalRejection)
            return { kind: "rejected" as const, code: error.code, retryable: false };
          return { kind: "uncertain" as const, code: "provider_unavailable", retryable: true };
        }
      });
    },
  };
}
