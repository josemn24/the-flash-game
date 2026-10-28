import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { AnswerValue } from "@/types/contracts";
import type { DurationMs, UtcIsoDateTime } from "@/types/domain/values";
import type {
  AuthoritativeSessionUpdate,
  GameSessionAcceptance,
  GameSessionResult,
} from "@/types/gameplay/authoritative-session";
import type { AnswerResult } from "@/types/gameplay/result";
import type {
  ServerAlphabetLetterStatus,
  ServerAlphabetProgress,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { LocalAlphabetDefinition } from "@/types/gameplay/local-alphabet";
import { evaluateCompetitiveReceipt } from "@/lib/scoringCore/competitiveReceipt";
import { countAlphabetAnswerCharacters } from "@/lib/gameplay/alphabetAnswerSlots";
import { randomUuid } from "@/lib/randomUuid";
import { systemSessionClock } from "../clock";
import { compileAlphabetDefinition } from "./localShared/definition";
import { LocalRejection, reject } from "./localShared/formats";
import { createLocalCommandQueue, localCommandSignature } from "./localShared/runtime";

export type LocalAlphabetOptions = {
  readonly definition: LocalAlphabetDefinition;
  readonly clock?: SessionClock;
  readonly createSessionId?: () => string;
};

type LetterState = {
  status: ServerAlphabetLetterStatus;
  answer: string | null;
  visited: boolean;
  elapsedMs: number;
};
type ActiveLetter = { readonly index: number; readonly presentedAt: number };
type CachedCommand = { readonly signature: string; readonly result: GameSessionResult };

const iso = (time: number | null): UtcIsoDateTime | null =>
  time === null ? null : (new Date(time).toISOString() as UtcIsoDateTime);

/** In-memory Alphabet authority. Its private fixture never enters public session updates. */
export function createLocalAlphabetSessionProvider(
  options: LocalAlphabetOptions,
): GameSessionProvider {
  const { definition, levels } = compileAlphabetDefinition(options.definition);
  const { challenge } = definition;
  const clock = options.clock ?? systemSessionClock;
  const letters: LetterState[] = challenge.entries.map(() => ({
    status: "unvisited",
    answer: null,
    visited: false,
    elapsedMs: 0,
  }));
  const answers = new Map<number, AnswerResult>();
  const cached = new Map<string, CachedCommand>();
  const enqueue = createLocalCommandQueue();
  let sessionId: string | undefined;
  let revision = 0;
  let status: "new" | "in_progress" | "completed" | "abandoned" = "new";
  let deadlineAt: number | null = null;
  let active: ActiveLetter | null = null;
  let currentIndex = 0;
  let intervalCount = 0;
  let lastCorrectAt: number | null = null;
  let terminalAt: number | null = null;

  const score = () => [...answers.values()].reduce((sum, answer) => sum + answer.points, 0);
  const resultRows = () =>
    [...answers.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, answer]) => structuredClone(answer));
  const progress = (now: number): ServerAlphabetProgress => ({
    kind: "alphabet",
    round: Math.max(1, 1 + Math.floor(intervalCount / challenge.entries.length)),
    currentIndex,
    playedCount: letters.filter((letter) => letter.visited).length,
    correctAnswers: resultRows().filter((answer) => answer.status === "correct").length,
    incorrectAnswers: resultRows().filter((answer) => answer.status === "incorrect").length,
    elapsedTimeMs: letters.reduce((sum, letter) => sum + letter.elapsedMs, 0),
    deadlineAt: iso(deadlineAt) ?? new Date(now).toISOString(),
    lastCorrectAt: iso(lastCorrectAt),
    letters: challenge.entries.map((entry, index) => ({
      letter: entry.letter,
      challengeItemId: entry.id,
      status: letters[index]!.status,
      answer: letters[index]!.answer,
    })),
  });
  const review = (): ServerFlashTerminalReview[] =>
    challenge.entries.map((entry, index) => ({
      challengeItemId: entry.id,
      publicPayload: structuredClone(levels[index]!.publicPayload),
      solutionPayload: structuredClone(levels[index]!.solutionPayload),
    }));
  const accepted = (
    effect: GameSessionAcceptance["effect"],
    state: AuthoritativeSessionUpdate,
  ): GameSessionAcceptance =>
    effect === "completed"
      ? { kind: "accepted", effect, state, review: review() }
      : { kind: "accepted", effect, state };
  const terminal = (now: number): GameSessionAcceptance =>
    accepted("completed", {
      sessionId,
      revision,
      phase: "results",
      ...(status === "abandoned" ? { status: "abandoned" as const } : {}),
      score: status === "abandoned" ? 0 : score(),
      answers: resultRows(),
      terminalReason: null,
      progress: progress(now),
    });
  const openedDuration = (index: number, now: number) => {
    const item = active;
    return item?.index === index
      ? Math.max(0, Math.floor(Math.min(now, deadlineAt ?? now) - item.presentedAt))
      : 0;
  };
  const closeActive = (endAt: number) => {
    if (!active) return;
    const { index } = active;
    letters[index]!.elapsedMs += openedDuration(index, endAt);
    active = null;
  };
  const pendingIndexes = () =>
    challenge.entries.map((_entry, index) => index).filter((index) => !answers.has(index));
  const nextPendingIndex = () => {
    const pending = pendingIndexes();
    const unseen = pending.find((index) => !letters[index]!.visited);
    if (unseen !== undefined) return unseen;
    return (
      pending
        .filter((index) => letters[index]!.status === "passed")
        .sort((left, right) => {
          const leftWraps = left <= currentIndex ? 1 : 0;
          const rightWraps = right <= currentIndex ? 1 : 0;
          return leftWraps - rightWraps || left - right;
        })[0] ?? null
    );
  };
  const prepared = (index: number, now: number, timedOut = false): AuthoritativeSessionUpdate => {
    const entry = challenge.entries[index]!;
    const level = levels[index]!;
    return {
      sessionId,
      revision,
      challengeItemId: entry.id,
      publicPayload: timedOut ? null : structuredClone(level.publicPayload),
      answerLength:
        level.question.type === "short-text"
          ? countAlphabetAnswerCharacters(level.question.correctAnswer) || null
          : null,
      progress: progress(now),
      presentedAt: iso(active?.index === index ? active.presentedAt : null),
      deadlineAt: iso(deadlineAt),
      timedOut,
    };
  };
  const evaluate = (
    index: number,
    answer: AnswerValue | null,
    submittedAt: number,
    timedOut = false,
  ): AnswerResult => {
    const entry = challenge.entries[index]!;
    const level = levels[index]!;
    const timeUsedMs = letters[index]!.elapsedMs;
    // Short-text scoring is shared with the competitive receipt evaluator.
    const evaluated = evaluateCompetitiveReceipt({
      question: level.question,
      answer: timedOut ? null : answer,
      receipt: { timeUsedMs: timeUsedMs as DurationMs, timedOut },
    });
    const result: AnswerResult = {
      questionId: entry.id,
      answer: timedOut ? null : answer,
      status: timedOut ? "unanswered" : evaluated.status,
      isCorrect: !timedOut && evaluated.status === "correct",
      points: timedOut ? 0 : evaluated.points,
      timeUsed: timeUsedMs / 1_000,
      ...(evaluated.details && !timedOut ? { details: evaluated.details } : {}),
    };
    answers.set(index, result);
    letters[index]!.status =
      result.status === "correct"
        ? "correct"
        : result.status === "partial"
          ? "incorrect"
          : result.status;
    letters[index]!.answer = typeof answer === "string" && !timedOut ? answer : null;
    if (result.isCorrect) lastCorrectAt = submittedAt;
    return result;
  };
  const maybeTerminal = (now: number) => {
    if (pendingIndexes().length === 0) {
      terminalAt ??= lastCorrectAt ?? now;
      return true;
    }
    return deadlineAt !== null && now >= deadlineAt;
  };
  const finish = (now: number, abandon = false): GameSessionAcceptance => {
    if (abandon) {
      closeActive(now);
      terminalAt ??= now;
      status = "abandoned";
    } else {
      const timedOut = deadlineAt !== null && now >= deadlineAt;
      if (!timedOut && pendingIndexes().length > 0) return reject("alphabet_deadline_not_reached");
      if (timedOut) {
        closeActive(deadlineAt!);
        for (const index of pendingIndexes()) evaluate(index, null, deadlineAt!, true);
      } else {
        terminalAt ??= lastCorrectAt ?? now;
      }
      status = "completed";
    }
    revision++;
    return terminal(now);
  };

  const run = async (
    command: GameSessionCommand,
    signal?: AbortSignal,
    receivedAt = clock.now(),
  ): Promise<GameSessionResult> => {
    if (signal?.aborted) return { kind: "uncertain", code: "request_cancelled", retryable: true };
    const { operation, input } = command;
    const key = "idempotencyKey" in input ? input.idempotencyKey : undefined;
    const signature = localCommandSignature(command);
    const prior = key ? cached.get(key) : undefined;
    if (prior) return prior.signature === signature ? prior.result : reject("idempotency_conflict");
    if ("challengeId" in input && input.challengeId !== challenge.id)
      return reject("invalid_command");
    if (operation === "prepareSession") return accepted("acknowledged", { ready: true });

    if (operation === "start") {
      if (status === "completed" || status === "abandoned") return reject("attempt_terminal");
      const resumed = status === "in_progress";
      if (!resumed) {
        sessionId = (options.createSessionId ?? randomUuid)();
        status = "in_progress";
        revision = 1;
        deadlineAt = receivedAt + challenge.timeLimitMs;
      }
      const result = accepted("acknowledged", {
        sessionId,
        revision,
        resumed,
        deadlineAt: iso(deadlineAt),
        progress: progress(receivedAt),
      });
      if (key) cached.set(key, { signature, result });
      return result;
    }

    if (!sessionId || !("sessionId" in input) || input.sessionId !== sessionId)
      return reject("not_authorized");
    if (operation === "recover" && (status === "completed" || status === "abandoned"))
      return terminal(receivedAt);
    if (operation === "complete" && (status === "completed" || status === "abandoned"))
      return terminal(receivedAt);
    if (input.revision !== revision) return reject("stale_version");
    if (status !== "in_progress") return reject("attempt_terminal");

    let result: GameSessionResult;
    if (operation === "abandon") {
      result = finish(receivedAt, true);
    } else if (operation === "recover") {
      if (active) {
        result = accepted("acknowledged", {
          ...prepared(active.index, receivedAt),
          phase: "playing",
        });
      } else {
        result = accepted("acknowledged", {
          sessionId,
          revision,
          phase: "countdown",
          answers: resultRows(),
          deadlineAt: iso(deadlineAt),
          progress: progress(receivedAt),
        });
      }
    } else if (operation === "prepare") {
      if (receivedAt >= (deadlineAt ?? 0)) {
        result = accepted("acknowledged", prepared(currentIndex, receivedAt, true));
      } else {
        const index = active?.index ?? nextPendingIndex();
        if (index === null) return reject("no_pending_item");
        if (!active) {
          active = { index, presentedAt: receivedAt };
          currentIndex = index;
          letters[index]!.visited = true;
          letters[index]!.status = "active";
          intervalCount++;
        }
        revision++;
        result = accepted("acknowledged", prepared(index, receivedAt));
      }
    } else if (operation === "complete") {
      if (!maybeTerminal(receivedAt)) return reject("alphabet_deadline_not_reached");
      result = finish(receivedAt);
    } else if (operation === "alphabetPass" || operation === "answer") {
      if (!("challengeItemId" in input)) return reject("invalid_command");
      if (!active || challenge.entries[active.index]?.id !== input.challengeItemId)
        return reject("interaction_not_presented");
      const index = active.index;
      if (operation === "alphabetPass") {
        if (receivedAt >= (deadlineAt ?? 0)) return reject("pass_unavailable");
        closeActive(receivedAt);
        letters[index]!.status = "passed";
        revision++;
        result = accepted("acknowledged", {
          sessionId,
          revision,
          challengeItemId: challenge.entries[index]!.id,
          status: "unanswered",
          timeUsedMs: letters[index]!.elapsedMs,
          progress: progress(receivedAt),
        });
      } else {
        if (input.answer !== null && typeof input.answer !== "string")
          return reject("invalid_answer");
        const timedOut = receivedAt >= (deadlineAt ?? 0);
        closeActive(timedOut ? (deadlineAt ?? receivedAt) : receivedAt);
        const answer = timedOut ? null : input.answer;
        const answerResult = evaluate(
          index,
          answer,
          timedOut ? (deadlineAt ?? receivedAt) : receivedAt,
          timedOut,
        );
        revision++;
        result = accepted("evaluated", {
          sessionId,
          challengeItemId: challenge.entries[index]!.id,
          revision,
          status: answerResult.status,
          points: answerResult.points,
          timeUsedMs: Math.round(answerResult.timeUsed * 1_000),
          timedOut,
          progress: progress(receivedAt),
        });
      }
    } else {
      return reject("unsupported_question");
    }

    if (signal?.aborted) return { kind: "uncertain", code: "request_cancelled", retryable: true };
    if (key) cached.set(key, { signature, result });
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
            return { kind: "rejected" as const, code: error.code, retryable: false };
          return { kind: "uncertain" as const, code: "provider_unavailable", retryable: true };
        }
      });
    },
  };
}
