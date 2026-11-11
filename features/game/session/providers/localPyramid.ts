import { createSessionResultDecoder, sessionValidationContext } from "../sessionResult";
import type { GameSessionFailure } from "@/types/contracts/game-session";
type LocalSessionResult =
  import("@/types/gameplay/authoritative-session").SessionResultDraft | GameSessionFailure;
import type { GameSessionErrorCode } from "@/types/contracts/competitive-errors";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { AnswerValue } from "@/types/contracts";
import type {
  SessionResultDraft,
  AuthoritativeSessionUpdate,
} from "@/types/gameplay/authoritative-session";
import type { LocalPyramidDefinition } from "@/types/gameplay/local-pyramid";
import type { AnswerResult } from "@/types/gameplay/result";
import { randomUuid } from "@/lib/randomUuid";
import {
  deriveCompetitivePyramidProgress,
  normalizePyramidResult,
} from "@/lib/gameplay/pyramidProgress";
import { evaluateCompetitiveReceipt } from "@/lib/scoringCore/competitiveReceipt";
import { calculateConnectPairsMetrics } from "@/lib/connectPairs";
import { connectPairsTimeoutPartial } from "@/lib/scoringCore/questions/connectPairs";
import {
  pyramidTimeoutCreditEnabled,
  timeoutPartialPoints,
} from "@/lib/gameplay/pyramidTimeoutCredit";
import { QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS } from "@/lib/queens";
import { pyramidEvaluation, pyramidNullEvaluation } from "@/lib/scoringCore/pyramid";
import { scaleProgressiveCluePenalty } from "@/lib/scoringCore/questions/progressiveClues";
import { isMatchingAnswer } from "@/lib/scoringCore/questions/matching";
import type { DurationMs } from "@/types/domain/values";
import { systemSessionClock } from "../clock";
import { createLocalCommandQueue, localCommandSignature } from "./localShared/runtime";
import { compileDefinition, type CompiledLevel } from "./localShared/definition";
import {
  initialFormatState,
  formatProgress,
  formatReviewState,
  transitionFormat,
  LocalRejection,
  reject,
} from "./localShared/formats";

export type LocalPyramidOptions = {
  definition: LocalPyramidDefinition;
  clock?: SessionClock;
  createSessionId?: () => string;
  dictionaries?: ReadonlyMap<string, ReadonlySet<string>>;
};
type Receipt = {
  index: number;
  answer: AnswerValue | null;
  timeUsedMs: number;
  timedOut: boolean;
  checkpointTimeUsedMs?: number;
  result?: AnswerResult;
};
type Cached = {
  signature: string;
  result?: SessionResultDraft;
  receipt?: Receipt;
  update?: AuthoritativeSessionUpdate;
};
const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

/** Single in-memory authority. It never imports mock data, transport, React or server modules. */
export function createLocalPyramidSessionProvider(
  options: LocalPyramidOptions,
): GameSessionProvider {
  const { definition, levels } = compileDefinition(options.definition);
  const clock = options.clock ?? systemSessionClock;
  const dictionaries = new Map(
    [...(options.dictionaries ?? [])].map(([id, words]) => [id, new Set(words)]),
  );
  for (const { question } of levels) {
    if (
      question.type === "mini-wordle" &&
      question.dictionaryId &&
      !dictionaries.has(question.dictionaryId)
    )
      throw new Error(`missing_local_dictionary:${question.dictionaryId}`);
  }
  let sessionId: string | undefined;
  let revision = 0;
  let status: "new" | "in_progress" | "completed" | "abandoned" = "new";
  let prepared: number | null = null;
  let active: { index: number; presentedAt: number; deadlineAt: number } | null = null;
  let receipt: Receipt | undefined;
  const answers: AnswerResult[] = [];
  const formats = levels.map(initialFormatState);
  const checkpointSavedAt = new Map<number, number>();
  const usesTimeoutCredit = (level: CompiledLevel) =>
    pyramidTimeoutCreditEnabled(definition.challenge, level.question.type);
  const cache = new Map<string, Cached>();
  const enqueue = createLocalCommandQueue();
  const accept = (
    effect: SessionResultDraft["effect"],
    state: AuthoritativeSessionUpdate,
  ): SessionResultDraft =>
    effect === "completed"
      ? { kind: "accepted", effect, state: { sessionId, ...state }, review: review() }
      : { kind: "accepted", effect, state: { sessionId, ...state } };
  const progress = () => deriveCompetitivePyramidProgress(7, answers);
  const review = () =>
    status === "abandoned"
      ? []
      : answers.map((answer) => {
          const level = levels.find((row) => row.source.challengeItemId === answer.questionId)!;
          return {
            challengeItemId: answer.questionId,
            publicPayload: level.publicPayload,
            solutionPayload: level.solutionPayload,
          };
        });
  const finish = (abandoned = false) => {
    if (!abandoned && progress().outcome === "in_progress") return reject("pyramid_not_terminal");
    status = abandoned ? "abandoned" : "completed";
    active = null;
    prepared = null;
    revision++;
    return terminal();
  };
  const terminal = () =>
    accept("completed", {
      sessionId,
      revision,
      phase: "results",
      ...(status === "abandoned" ? { status: "abandoned" as const } : {}),
      score: status === "abandoned" ? 0 : progress().score,
      answers: [...answers],
      terminalReason: null,
    });
  const evaluate = (pending: Receipt) => {
    if (pending.result) return pending.result;
    const level = levels[pending.index]!;
    const state = formats[pending.index]!;
    const q = level.question;
    // Evaluation reconstructs accepted event facts, just like read_evaluation_context.
    const effective =
      q.type === "queens"
        ? { queens: state.queens, marks: [] }
        : q.type === "word-search"
          ? { foundWordIds: state.selections.map((s) => s.targetId) }
          : pending.answer;
    let reviewState = formatReviewState(level, state);
    if (
      !reviewState &&
      pending.checkpointTimeUsedMs !== undefined &&
      q.type === "queens" &&
      q.prefilledQueens?.length === q.grid.rows
    ) {
      reviewState = { type: "queens", queens: [...state.queens] };
    }
    let checkpointEvaluation: ReturnType<typeof pyramidEvaluation> | undefined;
    if (
      pending.checkpointTimeUsedMs !== undefined &&
      q.type === "connect-pairs" &&
      reviewState?.type === "connect-pairs"
    ) {
      const paths = Object.fromEntries(
        Object.entries(reviewState.paths).map(([id, path]) => [id, [...path]]),
      );
      if (calculateConnectPairsMetrics(q, { paths }).exact) {
        checkpointEvaluation = evaluateCompetitiveReceipt({
          question: q,
          answer: { paths },
          receipt: { timeUsedMs: pending.checkpointTimeUsedMs as DurationMs, timedOut: false },
        });
      } else {
        const partial = connectPairsTimeoutPartial(q, paths);
        checkpointEvaluation = {
          ...partial,
          status: partial.points > 0 ? "partial" : "unanswered",
        };
      }
    }
    if (
      pending.checkpointTimeUsedMs !== undefined &&
      q.type === "queens" &&
      reviewState?.type === "queens" &&
      state.incorrectValidations < QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS
    ) {
      const scored = evaluateCompetitiveReceipt({
        question: q,
        answer: { queens: [...reviewState.queens], marks: [] },
        receipt: { timeUsedMs: pending.checkpointTimeUsedMs as DurationMs, timedOut: false },
        incorrectAttempts: state.incorrectValidations,
      });
      if (scored.status === "correct") {
        checkpointEvaluation = scored;
      } else if (scored.details?.type === "queens") {
        const fixed = new Set(q.prefilledQueens ?? []);
        const requiredPlacements = q.grid.rows - fixed.size;
        const correctPlacements = reviewState.queens.filter(
          (cell) => !fixed.has(cell) && q.solution.includes(cell),
        ).length;
        const points = timeoutPartialPoints(q.points, correctPlacements, requiredPlacements);
        checkpointEvaluation = {
          status: points > 0 ? "partial" : "unanswered",
          points,
          details: {
            ...scored.details,
            timeoutPartialCredit: true,
            correctPlacements,
            requiredPlacements,
          },
        };
      }
    }
    if (pending.timedOut && q.type === "word-search" && usesTimeoutCredit(level)) {
      const foundWordIds = state.selections.map((selection) => selection.targetId);
      if (foundWordIds.length > 0) {
        const points = timeoutPartialPoints(q.points, foundWordIds.length, q.targets.length);
        reviewState = { type: "word-search", foundWordIds };
        checkpointEvaluation = {
          status: points > 0 ? "partial" : "unanswered",
          points,
          details: {
            type: "word-search",
            timeoutPartialCredit: true,
            foundWords: foundWordIds.length,
            totalWords: q.targets.length,
            incorrectSelections: state.incorrectSelections,
            solved: false,
          },
        };
      }
    }
    const unanswered = pending.answer === null && usesTimeoutCredit(level);
    const evaluated =
      checkpointEvaluation ??
      pyramidNullEvaluation(unanswered ? null : effective) ??
      pyramidEvaluation(
        evaluateCompetitiveReceipt({
          question: q,
          answer: effective,
          receipt: { timeUsedMs: pending.timeUsedMs as DurationMs, timedOut: pending.timedOut },
          submittedCodes: state.codes,
          incorrectAttempts:
            q.type === "queens"
              ? state.incorrectValidations
              : q.type === "word-search"
                ? state.incorrectSelections
                : 0,
          progressiveCluesRevealed: state.revealed,
          ...(q.type === "progressive-clues"
            ? {
                progressiveClueAvailablePoints: Math.max(
                  0,
                  q.points -
                    scaleProgressiveCluePenalty(q.cluePenalty, 100, q.points) *
                      (state.revealed - 1),
                ),
              }
            : {}),
        }),
        pending.timedOut,
        state.incorrectValidations,
      );
    const result = normalizePyramidResult({
      questionId: level.source.challengeItemId,
      answer: pending.answer,
      status: evaluated.status,
      isCorrect:
        evaluated.status === "correct" ||
        (evaluated.status === "partial" && checkpointEvaluation === undefined),
      points: evaluated.points,
      timeUsed: pending.timeUsedMs / 1000,
      ...(evaluated.details ? { details: evaluated.details } : {}),
      ...((pending.timedOut || pending.answer === null) && reviewState ? { reviewState } : {}),
    });
    pending.result = result;
    answers.push(result);
    revision++;
    receipt = undefined;
    return result;
  };
  const evaluationUpdate = (pending: Receipt, update: AuthoritativeSessionUpdate = {}) => {
    const result = evaluate(pending);
    return accept("evaluated", {
      ...update,
      challengeItemId: levels[pending.index]!.source.challengeItemId,
      revision,
      status: result.status,
      points: result.points,
      timeUsedMs: pending.timeUsedMs,
      timedOut: pending.timedOut,
      ...(result.details ? { details: result.details } : {}),
      ...(result.reviewState ? { reviewState: result.reviewState } : {}),
    });
  };
  const receive = (index: number, answer: AnswerValue | null, now: number): Receipt => {
    if (!active) return reject("interaction_not_presented");
    if (now < active.presentedAt) return reject("request_predates_presentation");
    const timedOut = now >= active.deadlineAt;
    const useCheckpoint = timedOut && usesTimeoutCredit(levels[index]!);
    const savedAt = useCheckpoint ? checkpointSavedAt.get(index) : undefined;
    const pending: Receipt = {
      index,
      answer: useCheckpoint ? null : structuredClone(answer),
      timeUsedMs: Math.floor(Math.max(0, Math.min(now, active.deadlineAt) - active.presentedAt)),
      timedOut,
      ...(savedAt !== undefined && savedAt >= active.presentedAt && savedAt < active.deadlineAt
        ? { checkpointTimeUsedMs: Math.floor(savedAt - active.presentedAt) }
        : {}),
    };
    receipt = pending;
    active = null;
    prepared = null;
    return pending;
  };
  const preparedUpdate = (index: number, now: number): AuthoritativeSessionUpdate => {
    const level = levels[index]!;
    const payload = structuredClone(level.publicPayload);
    if (level.question.type === "progressive-clues") {
      delete payload.clues;
      payload.clueCount = level.question.clues.length;
    }
    const timedOut = active !== null && now >= active.deadlineAt;
    return {
      revision,
      challengeItemId: level.source.challengeItemId,
      publicPayload: timedOut ? null : payload,
      progress: formatProgress(level, formats[index]!),
      presentedAt: iso(active?.presentedAt ?? null),
      deadlineAt: iso(active?.deadlineAt ?? null),
      timedOut,
    };
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
    const now = command.operation === "answer" ? receivedAt : clock.now();
    const { operation, input } = command;
    if (operation === "takeover" || operation === "alphabetPass") return reject("invalid_command");
    const key =
      "idempotencyKey" in input
        ? input.idempotencyKey
        : command.operation === "recover"
          ? `recovery:${command.input.sessionId}:${command.input.revision}`
          : undefined;
    const signature = localCommandSignature(command);
    const cached = key ? cache.get(key) : undefined;
    if (cached) {
      if (cached.signature !== signature) return reject("idempotency_conflict");
      if (cached.result) return cached.result;
      if (cached.receipt) {
        cached.result = evaluationUpdate(cached.receipt, cached.update);
        return cached.result;
      }
    }
    if ("challengeId" in input && input.challengeId !== definition.challenge.id)
      return reject("invalid_command");
    if (operation === "prepareSession") return accept("acknowledged", { ready: true });
    let result: SessionResultDraft;
    if (operation === "start") {
      if (status === "completed" || status === "abandoned") return reject("attempt_terminal");
      const resumed = status === "in_progress";
      if (!resumed) {
        const starts = Date.parse(definition.challenge.availableFrom);
        const ends = Date.parse(definition.challenge.availableUntil);
        if (now < starts || now >= ends) return reject("publication_not_open");
        sessionId = (options.createSessionId ?? randomUuid)();
        revision = 1;
        status = "in_progress";
      }
      result = accept("acknowledged", { sessionId, revision, resumed, deadlineAt: null });
    } else {
      if (!("sessionId" in input) || input.sessionId !== sessionId) return reject("not_authorized");
      if (
        (operation === "recover" || operation === "complete" || operation === "abandon") &&
        status !== "in_progress"
      )
        return terminal();
      if (input.revision !== revision) return reject("stale_version");
      if (status !== "in_progress") return reject("attempt_terminal");
      if (operation === "abandon") return finish(true);
      if (operation === "complete") {
        if (active || receipt) return reject("unfinished_interaction");
        if (!answers.length) return reject("no_evaluated_answers");
        result = finish();
      } else if (operation === "recover") {
        let resolved: Receipt | undefined = receipt;
        if (!resolved && active) {
          const index = active.index;
          resolved = receive(
            index,
            levels[index]!.question.type === "word-hashtag"
              ? { swaps: formats[index]!.swaps }
              : null,
            now,
          );
        }
        revision++;
        if (resolved) evaluate(resolved);
        if (progress().outcome !== "in_progress") {
          const completed = finish();
          result = {
            ...completed,
            state: {
              ...completed.state,
              ...(resolved
                ? { resolved: { challengeItemId: levels[resolved.index]!.source.challengeItemId } }
                : {}),
            },
          };
        } else
          result = accept("acknowledged", {
            sessionId,
            revision,
            answers: [...answers],
            phase: "briefing",
            ...(resolved
              ? { resolved: { challengeItemId: levels[resolved.index]!.source.challengeItemId } }
              : {}),
          });
      } else if (operation === "prepare") {
        if (receipt) return reject("evaluation_pending");
        if (progress().outcome === "failed") return reject("pyramid_level_failed");
        const index = active?.index ?? prepared ?? answers.length;
        if (!levels[index]) return reject("no_pending_item");
        prepared = index;
        revision++;
        result = accept("acknowledged", preparedUpdate(index, now));
      } else {
        if (!("challengeItemId" in input)) return reject("invalid_command");
        const index = active?.index ?? prepared;
        if (index === null || levels[index]?.source.challengeItemId !== input.challengeItemId)
          return reject("interaction_not_presented");
        const level = levels[index]!;
        if (operation === "activate") {
          if (!active)
            active = { index, presentedAt: now, deadlineAt: now + level.question.timeLimit * 1000 };
          prepared = null;
          revision++;
          result = accept("acknowledged", {
            revision,
            challengeItemId: level.source.challengeItemId,
            presentedAt: iso(active.presentedAt),
            deadlineAt: iso(active.deadlineAt),
            timedOut: now >= active.deadlineAt,
          });
        } else {
          if (!active || receipt)
            return reject(receipt ? "evaluation_pending" : "interaction_not_presented");
          let pending: Receipt | undefined;
          let update: AuthoritativeSessionUpdate = {};
          if (operation === "answer") {
            validateAnswer(level, input.answer, now >= active.deadlineAt);
            const answer =
              input.answer === null && level.question.type === "word-hashtag"
                ? { swaps: formats[index]!.swaps }
                : input.answer;
            pending = receive(index, answer, now);
            revision++;
          } else {
            const savesDraft = operation === "queensDraft" || operation === "connectPairsDraft";
            if (now >= active.deadlineAt && (!savesDraft || usesTimeoutCredit(level)))
              return reject("deadline_reached");
            const transition = transitionFormat(level, formats[index]!, command, dictionaries);
            formats[index] = transition.state;
            if ((savesDraft || operation === "queensValidation") && usesTimeoutCredit(level))
              checkpointSavedAt.set(index, now);
            update = transition.update;
            if (operation === "miniWordleGuess")
              update = { ...update, timeUsedMs: Math.floor(now - active.presentedAt) };
            revision++;
            if (transition.terminal) pending = receive(index, transition.answer, now);
          }
          if (pending) {
            const entry: Cached = { signature, receipt: pending, update };
            if (key) cache.set(key, entry);
            // A receipt is durable before evaluation. Cancellation cannot erase accepted input.
            await Promise.resolve();
            if (signal?.aborted) return cancelled();
            result = evaluationUpdate(pending, update);
            entry.result = result;
          } else
            result = accept("progress", {
              ...update,
              challengeItemId: level.source.challengeItemId,
              revision,
            });
        }
      }
    }
    if (key) cache.set(key, { signature, result });
    return result;
  };
  const decodeResult = createSessionResultDecoder(sessionValidationContext(definition.challenge));
  return {
    execute(command, execution) {
      const captured = structuredClone(command);
      const receivedAt = clock.now();
      return enqueue(async () => {
        try {
          return decodeResult(
            command,
            structuredClone(await run(captured, execution?.signal, receivedAt)),
          );
        } catch (error) {
          if (error instanceof LocalRejection)
            return { kind: "rejected" as const, code: error.code, retryable: false };
          // Accepted receipts stay available for an exact replay or recovery.
          return { kind: "uncertain" as const, code: "provider_unavailable", retryable: true };
        }
      });
    },
  };
}

function validateAnswer(level: CompiledLevel, answer: AnswerValue | null, timedOut: boolean) {
  const q = level.question;
  if (answer !== null) {
    const protocols: Partial<Record<typeof q.type, GameSessionErrorCode>> = {
      "mini-wordle": "mini_wordle_requires_guess_command",
      "logic-code": "logic_code_requires_attempt_command",
      queens: "queens_requires_placement_command",
      "word-search": "word_search_requires_selection_command",
      "word-hashtag": "word_hashtag_requires_swap_command",
    };
    if (protocols[q.type]) return reject(protocols[q.type]!);
  }
  if (q.type === "matching" && (!timedOut || answer !== null)) {
    if (!isMatchingAnswer(answer)) return reject("invalid_matching_answer");
    const entries = Object.entries(answer);
    if (
      (!timedOut && entries.length !== q.leftItems.length) ||
      entries.some(
        ([left, right]) =>
          !q.leftItems.some((i) => i.id === left) || !q.rightItems.some((i) => i.id === right),
      ) ||
      new Set(entries.map(([, right]) => right)).size !== entries.length
    )
      return reject("invalid_matching_answer");
  }
}
