import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { AnswerValue } from "@/types/contracts";
import type {
  AuthoritativeSessionUpdate,
  GameSessionAcceptance,
  GameSessionResult,
} from "@/types/gameplay/authoritative-session";
import type { LocalFlashDefinition } from "@/types/gameplay/local-pyramid";
import type { AnswerResult } from "@/types/gameplay/result";
import type { DurationMs } from "@/types/domain/values";
import { evaluateCompetitiveReceipt } from "@/lib/scoringCore/competitiveReceipt";
import { scaleProgressiveCluePenalty } from "@/lib/scoringCore/questions/progressiveClues";
import { isMatchingAnswer } from "@/lib/scoringCore/questions/matching";
import { randomUuid } from "@/lib/randomUuid";
import { systemSessionClock } from "../clock";
import { compileFlashDefinition, type CompiledLevel } from "./localShared/definition";
import {
  formatProgress,
  initialFormatState,
  LocalRejection,
  reject,
  transitionFormat,
} from "./localShared/formats";
import { createLocalCommandQueue, localCommandSignature } from "./localShared/runtime";

export type LocalFlashOptions = {
  readonly definition: LocalFlashDefinition;
  readonly clock?: SessionClock;
  readonly createSessionId?: () => string;
  readonly dictionaries?: ReadonlyMap<string, ReadonlySet<string>>;
};

type Receipt = {
  readonly index: number;
  readonly answer: AnswerValue | null;
  readonly timeUsedMs: number;
  readonly timedOut: boolean;
  result?: AnswerResult;
};
type CachedCommand = {
  readonly signature: string;
  result?: GameSessionAcceptance;
  receipt?: Receipt;
  update?: AuthoritativeSessionUpdate;
};
type ActiveQuestion = {
  readonly index: number;
  readonly presentedAt: number;
  readonly deadlineAt: number;
};
const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

/** In-memory Flash authority. It uses canonical evaluators and the shared format transitions. */
export function createLocalFlashSessionProvider(options: LocalFlashOptions): GameSessionProvider {
  const { definition, levels } = compileFlashDefinition(options.definition);
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
  let active: ActiveQuestion | null = null;
  let receipt: Receipt | undefined;
  const answers: AnswerResult[] = [];
  const formats = levels.map(initialFormatState);
  const cache = new Map<string, CachedCommand>();
  const enqueue = createLocalCommandQueue();
  const accept = (
    effect: GameSessionAcceptance["effect"],
    state: AuthoritativeSessionUpdate,
  ): GameSessionAcceptance =>
    effect === "completed"
      ? { kind: "accepted", effect, state, review: review() }
      : { kind: "accepted", effect, state };
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
  const terminal = () =>
    accept("completed", {
      sessionId,
      revision,
      phase: "results",
      ...(status === "abandoned" ? { status: "abandoned" as const } : {}),
      score: status === "abandoned" ? 0 : answers.reduce((sum, answer) => sum + answer.points, 0),
      answers: [...answers],
      terminalReason: null,
    });
  const finish = (abandoned = false) => {
    if (!abandoned && answers.length !== levels.length) return reject("flash_not_terminal");
    status = abandoned ? "abandoned" : "completed";
    active = null;
    revision++;
    return terminal();
  };
  const evaluate = (pending: Receipt) => {
    if (pending.result) return pending.result;
    const level = levels[pending.index]!;
    const state = formats[pending.index]!;
    const question = level.question;
    const effective =
      question.type === "queens"
        ? { queens: state.queens, marks: [] }
        : question.type === "word-search"
          ? { foundWordIds: state.selections.map((selection) => selection.targetId) }
          : question.type === "word-hashtag"
            ? { swaps: state.swaps }
            : question.type === "mini-wordle"
              ? { guesses: state.guesses }
              : pending.answer;
    const evaluated = evaluateCompetitiveReceipt({
      question,
      answer: effective,
      receipt: { timeUsedMs: pending.timeUsedMs as DurationMs, timedOut: pending.timedOut },
      submittedCodes: state.codes,
      incorrectAttempts:
        question.type === "queens"
          ? state.incorrectValidations
          : question.type === "word-search"
            ? state.incorrectSelections
            : 0,
      progressiveCluesRevealed: state.revealed,
      ...(question.type === "progressive-clues"
        ? {
            progressiveClueAvailablePoints: Math.max(
              0,
              question.points -
                scaleProgressiveCluePenalty(question.cluePenalty, 100, question.points) *
                  (state.revealed - 1),
            ),
          }
        : {}),
    });
    const result = {
      questionId: level.source.challengeItemId,
      answer: pending.answer,
      status: evaluated.status,
      isCorrect: evaluated.status === "correct" || evaluated.status === "partial",
      points: evaluated.points,
      timeUsed: pending.timeUsedMs / 1000,
      ...(evaluated.details ? { details: evaluated.details } : {}),
    } satisfies AnswerResult;
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
    });
  };
  const receive = (index: number, answer: AnswerValue | null, now: number): Receipt => {
    if (!active) return reject("interaction_not_presented");
    if (now < active.presentedAt) return reject("request_predates_presentation");
    const pending: Receipt = {
      index,
      answer: structuredClone(answer),
      timeUsedMs: Math.floor(Math.max(0, Math.min(now, active.deadlineAt) - active.presentedAt)),
      timedOut: now >= active.deadlineAt,
    };
    receipt = pending;
    active = null;
    return pending;
  };
  const preparedUpdate = (index: number, now: number): AuthoritativeSessionUpdate => {
    const level = levels[index]!;
    const payload = structuredClone(level.publicPayload);
    if (level.question.type === "progressive-clues") {
      delete payload.clues;
      payload.clueCount = level.question.clues.length;
    }
    return {
      revision,
      challengeItemId: level.source.challengeItemId,
      publicPayload: active && now >= active.deadlineAt ? null : payload,
      progress: formatProgress(level, formats[index]!),
      presentedAt: iso(active?.presentedAt ?? null),
      deadlineAt: iso(active?.deadlineAt ?? null),
      timedOut: active !== null && now >= active.deadlineAt,
    };
  };

  const run = async (
    command: GameSessionCommand,
    signal?: AbortSignal,
    receivedAt = clock.now(),
  ): Promise<GameSessionResult> => {
    const cancelled = (): GameSessionResult => ({
      kind: "uncertain",
      code: "request_cancelled",
      retryable: true,
    });
    if (signal?.aborted) return cancelled();
    const now = command.operation === "answer" ? receivedAt : clock.now();
    const { operation, input } = command;
    if (operation === "takeover" || operation === "alphabetPass" || operation === "activate")
      return reject("invalid_command");
    const key =
      "idempotencyKey" in input
        ? input.idempotencyKey
        : operation === "recover"
          ? `recovery:${input.sessionId}:${input.revision}`
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
    let result: GameSessionAcceptance;
    if (operation === "start") {
      if (status === "completed" || status === "abandoned") return reject("attempt_terminal");
      const resumed = status === "in_progress";
      if (!resumed) {
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
        if (answers.length !== levels.length) return reject("flash_not_terminal");
        result = finish();
      } else if (operation === "recover") {
        if (receipt) {
          const resolved = receipt;
          revision++;
          evaluate(resolved);
          result = accept("acknowledged", {
            sessionId,
            revision,
            answers: [...answers],
            phase: "briefing",
            resolved: { challengeItemId: levels[resolved.index]!.source.challengeItemId },
          });
        } else if (active) {
          result = accept("acknowledged", {
            sessionId,
            ...preparedUpdate(active.index, now),
            phase: "playing",
          });
        } else {
          result = accept("acknowledged", {
            sessionId,
            revision,
            phase: "countdown",
            answers: [...answers],
          });
        }
      } else if (operation === "prepare") {
        if (receipt) return reject("evaluation_pending");
        const index = active?.index ?? answers.length;
        if (!levels[index]) return reject("no_pending_item");
        if (!active)
          active = {
            index,
            presentedAt: now,
            deadlineAt: now + levels[index]!.question.timeLimit * 1000,
          };
        revision++;
        result = accept("acknowledged", preparedUpdate(index, now));
      } else {
        if (!("challengeItemId" in input)) return reject("invalid_command");
        const index = active?.index ?? null;
        if (index === null || levels[index]?.source.challengeItemId !== input.challengeItemId)
          return reject("interaction_not_presented");
        const level = levels[index]!;
        if (operation === "answer") {
          validateAnswer(level, input.answer, now >= active!.deadlineAt);
          const pending = receive(index, input.answer, now);
          revision++;
          const entry: CachedCommand = { signature, receipt: pending };
          if (key) cache.set(key, entry);
          await Promise.resolve();
          if (signal?.aborted) return cancelled();
          result = evaluationUpdate(pending);
          entry.result = result;
        } else {
          if (now >= active!.deadlineAt) return reject("deadline_reached");
          const transition = transitionFormat(level, formats[index]!, command, dictionaries);
          formats[index] = transition.state;
          revision++;
          if (transition.terminal) {
            const pending = receive(index, transition.answer, now);
            const entry: CachedCommand = { signature, receipt: pending, update: transition.update };
            if (key) cache.set(key, entry);
            await Promise.resolve();
            if (signal?.aborted) return cancelled();
            result = evaluationUpdate(pending, transition.update);
            entry.result = result;
          } else {
            result = accept("progress", {
              ...transition.update,
              challengeItemId: level.source.challengeItemId,
              revision,
            });
          }
        }
      }
    }
    if (key) cache.set(key, { signature, result });
    return result;
  };

  return {
    execute(command, execution) {
      const captured = structuredClone(command);
      const receivedAt = clock.now();
      return enqueue(async () => {
        try {
          return structuredClone(await run(captured, execution?.signal, receivedAt));
        } catch (error) {
          if (error instanceof LocalRejection)
            return { kind: "rejected" as const, code: error.message, retryable: false };
          return { kind: "uncertain" as const, code: "provider_unavailable", retryable: true };
        }
      });
    },
  };
}

function validateAnswer(level: CompiledLevel, answer: AnswerValue | null, timedOut: boolean) {
  const question = level.question;
  if (answer !== null) {
    const protocols: Partial<Record<typeof question.type, string>> = {
      "mini-wordle": "mini_wordle_requires_guess_command",
      "logic-code": "logic_code_requires_attempt_command",
      queens: "queens_requires_placement_command",
      "word-search": "word_search_requires_selection_command",
      "word-hashtag": "word_hashtag_requires_swap_command",
    };
    if (protocols[question.type]) return reject(protocols[question.type]!);
  }
  if (question.type === "matching" && (!timedOut || answer !== null)) {
    if (!isMatchingAnswer(answer)) return reject("invalid_matching_answer");
    const entries = Object.entries(answer);
    if (
      (!timedOut && entries.length !== question.leftItems.length) ||
      entries.some(
        ([left, right]) =>
          !question.leftItems.some((item) => item.id === left) ||
          !question.rightItems.some((item) => item.id === right),
      ) ||
      new Set(entries.map(([, right]) => right)).size !== entries.length
    )
      return reject("invalid_matching_answer");
  }
}
