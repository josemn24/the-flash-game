import type { GameMode } from "@/types/domain/content";
import { resultDetails } from "@/lib/competitiveResponseContract";
import { alphabetProgress } from "@/lib/competitiveResponseContract";
import { preparedProgress } from "@/lib/competitiveResponseContract";
import { checkedTimeTrial } from "@/lib/competitiveResponseContract";
import type { GameSessionCommand, GameSessionOperation } from "@/types/contracts/game-session";
import type {
  GameSessionAcceptance,
  GameSessionResult,
  GameSessionValidationContext,
  SessionResultDraft,
} from "@/types/gameplay/authoritative-session";
import type { CompetitiveChallenge } from "@/types/gameplay/challenge";
import {
  answerStatus,
  boolean,
  date,
  fields,
  formatFields,
  integer,
  isRecord,
  nullable,
  oneOf,
  optionalFields,
  points,
  positive,
  record,
  requireResponse,
  reviewStateValue,
  text,
  wordHashtagState,
  timeTrialState,
} from "@/lib/competitiveResponseContract";
import { FORMAT_PUBLIC_VALIDATORS } from "@/lib/question-formats/publicRegistry";
import { readTimeTrialProgress } from "@/lib/timeTrial";

export function sessionValidationContext<C extends CompetitiveChallenge>(
  challenge: C,
): GameSessionValidationContext<C["mode"]> {
  return {
    mode: challenge.mode,
    timeLimitMs: challenge.mode === "time-trial" ? challenge.timeLimitMs : undefined,
    items:
      challenge.mode === "pyramid"
        ? challenge.levels
        : challenge.mode === "alphabet"
          ? challenge.entries
          : challenge.slots,
  };
}
export function sessionEffect(
  operation: GameSessionOperation,
  state: Record<string, unknown>,
): SessionResultDraft["effect"] {
  switch (operation) {
    case "complete":
    case "abandon":
      return "completed";
    case "recover":
      return state.phase === "results" || state.status === "abandoned"
        ? "completed"
        : "acknowledged";
    case "answer":
      return "evaluated";
    case "miniWordleGuess":
    case "logicCodeAttempt":
    case "wordHashtagSwap":
    case "queensValidation":
    case "wordSearchSelection":
      return state.terminal === true ? "evaluated" : "progress";
    case "queensDraft":
    case "connectPairsDraft":
    case "progressiveClueReveal":
      return "progress";
    case "prepareSession":
    case "start":
    case "takeover":
    case "prepare":
    case "activate":
    case "alphabetPass":
      return "acknowledged";
  }
}
/** Both authorities cross the same operation-specific boundary before the engine sees success. */
export function decodeSessionAcceptance<
  K extends GameSessionOperation,
  M extends GameMode = GameMode,
>(
  command: GameSessionCommand<K>,
  draft: SessionResultDraft,
  context?: GameSessionValidationContext<M>,
): GameSessionAcceptance<K, M> {
  const op = command.operation;
  const source = record(draft.state);
  // Readiness does not identify an attempt or own any authoritative session changes.
  const r: Record<string, unknown> = op === "prepareSession" ? { ready: source.ready } : source;
  if (op === "prepareSession") {
    fields(r, { ready: oneOf(true) });
  } else {
    fields(r, { sessionId: text, revision: positive });
    if ("sessionId" in command.input)
      requireResponse(r.sessionId === command.input.sessionId, "response.sessionId");
    if ("challengeItemId" in command.input && r.challengeItemId !== undefined)
      requireResponse(
        r.challengeItemId === command.input.challengeItemId,
        "response.challengeItemId",
      );
  }
  optionalFields(r, {
    deadlineAt: nullable(date),
    presentedAt: nullable(date),
    timedOut: boolean,
    points,
    timeUsedMs: integer,
    score: points,
    details: resultDetails,
    reviewState: reviewStateValue,
    reviewPending: boolean,
  });
  if (context?.mode === "time-trial" && op !== "prepareSession") {
    requireResponse(positive(context.timeLimitMs), "context.timeLimitMs");
    const requirement =
      draft.effect === "completed"
        ? op === "abandon" || r.status === "abandoned"
          ? "optional"
          : "result"
        : op === "start" || op === "takeover"
          ? "optional"
          : op === "recover" && r.phase !== "playing"
            ? "waiting-or-running"
            : op === "prepare" || op === "queensValidation" || op === "recover"
              ? "running"
              : "optional";
    timeTrialState(
      r,
      { timeLimitMs: context.timeLimitMs!, totalCount: context.items.length },
      requirement,
    );
  } else if (r.timeTrial !== undefined) checkedTimeTrial(readTimeTrialProgress, r.timeTrial);
  if (r.answers !== undefined) {
    requireResponse(Array.isArray(r.answers), "response.answers");
    r.answers.forEach((a) =>
      fields(record(a), {
        questionId: text,
        status: answerStatus,
        points,
        timeUsed: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
        isCorrect: boolean,
      }),
    );
    requireResponse(
      new Set(r.answers.map((a) => a.questionId)).size === r.answers.length,
      "response.answers",
    );
    if (context)
      requireResponse(
        r.answers.every((a) => context.items.some((i) => i.id === a.questionId)),
        "response.answers.questionId",
      );
  }
  if (draft.effect === "completed") {
    requireResponse(op === "complete" || op === "abandon" || op === "recover", "response.effect");
    fields(r, { phase: oneOf("results"), score: points });
    if (op === "recover") fields(r, { answers: Array.isArray });
  } else
    switch (op) {
      case "start":
        fields(r, { resumed: boolean, deadlineAt: nullable(date) });
        break;
      case "takeover":
        fields(r, { deadlineAt: nullable(date) });
        break;
      case "prepare": {
        fields(r, {
          challengeItemId: text,
          presentedAt: nullable(date),
          deadlineAt: nullable(date),
          timedOut: boolean,
        });
        requireResponse(
          (r.presentedAt === null) === (r.deadlineAt === null) ||
            (r.timedOut === true && r.presentedAt === null),
          "response.deadlineAt",
        );
        requireResponse(
          r.publicPayload !== undefined && (r.publicPayload !== null || r.timedOut === true),
          "response.publicPayload",
        );
        if (r.presentedAt !== null)
          requireResponse(
            Date.parse(String(r.deadlineAt)) >= Date.parse(String(r.presentedAt)),
            "response.deadlineAt",
          );
        if (context) {
          const item = context.items.find((i) => i.id === r.challengeItemId);
          requireResponse(item, "response.challengeItemId");
          requireResponse(
            context.mode === "pyramid" ||
              context.mode === "narrative" ||
              r.presentedAt !== null ||
              r.timedOut === true,
            "response.presentedAt",
          );
          preparedProgress(item.questionType, r.progress);
          if (item.questionType === "word-hashtag" && r.publicPayload !== null) {
            const payload = record(r.publicPayload, "response.publicPayload");
            wordHashtagState(r.progress, Number(payload.maxMoves));
          }
          if (context.mode === "alphabet")
            alphabetProgress(
              r.progress,
              context.items.map((i) => i.id),
            );
          if (r.publicPayload !== null) {
            const type = item.questionType as keyof typeof FORMAT_PUBLIC_VALIDATORS;
            requireResponse(Object.hasOwn(FORMAT_PUBLIC_VALIDATORS, type), "response.questionType");
            requireResponse(
              FORMAT_PUBLIC_VALIDATORS[type]({
                id: item.id,
                payload: r.publicPayload,
                progress: r.progress,
                timeLimitMs: item.timeLimitMs,
                points: item.points,
                mode: context.mode,
                payloadSchemaVersion: item.payloadSchemaVersion,
              }).ok,
              "response.publicPayload",
            );
          }
        } else if (r.publicPayload !== null)
          requireResponse(isRecord(r.publicPayload), "response.publicPayload");
        break;
      }
      case "activate":
        fields(r, {
          challengeItemId: text,
          presentedAt: date,
          deadlineAt: date,
          timedOut: boolean,
        });
        break;
      case "answer":
        fields(r, { challengeItemId: text, status: answerStatus, points, timeUsedMs: integer });
        break;
      case "recover":
        fields(r, {
          phase: oneOf("countdown", "prepare", "briefing", "playing"),
          answers: Array.isArray,
        });
        break;
      case "complete":
      case "abandon":
        requireResponse(false, "response.effect");
        break;
      case "alphabetPass":
        fields(r, { passed: oneOf(true) });
        break;
      case "connectPairsDraft":
        fields(r, { challengeItemId: text, reviewState: reviewStateValue });
        break;
      case "prepareSession":
        break;
      default:
        fields(r, { challengeItemId: text });
        formatFields(op, r, true);
        if (op === "wordHashtagSwap") {
          const item = context?.items.find((i) => i.id === r.challengeItemId);
          requireResponse(
            item?.questionType === "word-hashtag" && positive(item.wordHashtagMaxMoves),
            "context.maxMoves",
          );
          wordHashtagState(r, item.wordHashtagMaxMoves);
        }
    }
  const expectedEffect = sessionEffect(op, r);
  requireResponse(
    draft.effect === "completed" || draft.effect === expectedEffect,
    "response.effect",
  );
  // This assertion is localized to the validated union constructor; callers cannot select a result type.
  return { ...draft, operation: op, state: r } as GameSessionAcceptance<K, M>;
}
export function decodeSessionResult<K extends GameSessionOperation, M extends GameMode = GameMode>(
  command: GameSessionCommand<K>,
  result: SessionResultDraft | Exclude<GameSessionResult, { kind: "accepted" }>,
  context?: GameSessionValidationContext<M>,
): GameSessionResult<K, M> {
  if (result.kind !== "accepted") return result;
  try {
    return decodeSessionAcceptance(command, result, context);
  } catch {
    return { kind: "uncertain", code: "invalid_backend_response", retryable: true };
  }
}

/** Retain public configuration and immutable clock facts, never board state or solutions. */
export function createSessionResultDecoder<M extends GameMode>(
  context: GameSessionValidationContext<M>,
) {
  const maxMoves = new Map<string, number>();
  let sessionId: string | undefined;
  let globalClock: { startedAt: number; deadlineAt: number } | undefined;
  return <K extends GameSessionOperation>(
    command: GameSessionCommand<K>,
    draft: SessionResultDraft | Exclude<GameSessionResult, { kind: "accepted" }>,
  ): GameSessionResult<K, M> => {
    const result = decodeSessionResult(command, draft, {
      ...context,
      items: context.items.map((i) => ({
        ...i,
        wordHashtagMaxMoves: maxMoves.get(i.id) ?? i.wordHashtagMaxMoves,
      })),
    });
    if (result.kind !== "accepted") return result;
    if (result.operation === "prepareSession") return result;
    const clock = result.state.timeTrial;
    const activeClock =
      context.mode === "time-trial" && clock?.clockStartedAt && clock.deadlineAt
        ? { startedAt: Date.parse(clock.clockStartedAt), deadlineAt: Date.parse(clock.deadlineAt) }
        : undefined;
    if (result.state.sessionId === sessionId && globalClock) {
      if (
        activeClock &&
        (globalClock.startedAt !== activeClock.startedAt ||
          globalClock.deadlineAt !== activeClock.deadlineAt)
      )
        return { kind: "uncertain", code: "invalid_backend_response", retryable: true };
      if (clock?.clockStartedAt === null && result.effect !== "completed") {
        if (result.operation === "start" || result.operation === "takeover") {
          // A cached control acknowledgement can predate the first preparation.
          // Keep that acknowledgement without publishing its obsolete clock projection.
          const state = { ...result.state };
          Reflect.deleteProperty(state, "timeTrial");
          return decodeSessionResult(command, { ...result, state }, context);
        }
        return { kind: "uncertain", code: "invalid_backend_response", retryable: true };
      }
    }
    if (result.state.sessionId && result.state.sessionId !== sessionId) {
      sessionId = result.state.sessionId;
      maxMoves.clear();
      globalClock = undefined;
    }
    if (activeClock) globalClock = activeClock;
    if (result.operation === "prepare" && isRecord(result.state.publicPayload)) {
      const item = context.items.find((i) => i.id === result.state.challengeItemId);
      if (item?.questionType === "word-hashtag")
        maxMoves.set(item.id, Number(result.state.publicPayload.maxMoves));
    }
    return result;
  };
}
