import { compileDefinition } from "@/features/game/session/providers/localShared/definition";
import {
  formatProgress,
  initialFormatState,
} from "@/features/game/session/providers/localShared/formats";
import {
  correctActions,
  definitionFor,
  sessionCases,
} from "@/test-utils/game-session-conformance/corpus";
import type { SubmitWordHashtagSwapInput } from "@/types/contracts/attempts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseAttemptCommands } from "@/infrastructure/supabase/attempts/attemptCommands";
import { errorResponse } from "./attempt-api";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { CompetitiveSessionEngine } from "@/features/game/competitive/core/sessionEngine";
import { sessionValidationContext } from "@/features/game/session/sessionResult";
import type { ServerFlashChallenge } from "@/types/gameplay/challenge";
import type { AttemptCommandInput, SubmitAnswerInput } from "@/types/contracts/attempts";

const pg = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    connect = async () => pg;
  },
}));
const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");
const challenge: ServerFlashChallenge = {
  id: "challenge",
  definitionId: "definition",
  mode: "flash",
  number: 1,
  title: "Test",
  subtitle: "",
  description: "",
  maxScore: 100,
  slots: ["item", "next"].map((id, i) => ({
    id,
    position: i + 1,
    questionType: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: 60000,
    points: 50,
  })),
};
const at = "2026-10-01T10:00:00Z";
const base = { attemptId: "attempt", lockVersion: 1 };
const fixtures: Record<string, object> = {
  prepare_attempt_session: {},
  start_attempt: {
    ...base,
    sessionId: "controller",
    resumed: false,
    controlRequired: false,
    deadlineAt: null,
  },
  prepare_interaction: {
    ...base,
    lockVersion: 2,
    challengeItemId: "item",
    questionType: "multiple-choice",
    payloadSchemaVersion: 1,
    publicPayload: { question: "Elige", options: ["A", "B"] },
    presentedAt: at,
    deadlineAt: "2026-10-01T10:01:00Z",
    timedOut: false,
  },
  receive_answer: {
    ...base,
    lockVersion: 3,
    receiptId: "receipt",
    timedOut: false,
    timeUsedMs: 1000,
    receivedAt: "2026-10-01T10:00:01Z",
    presentedAt: at,
  },
  record_evaluation: {
    ...base,
    lockVersion: 4,
    receiptId: "receipt",
    status: "correct",
    points: 50,
  },
  complete_attempt: {
    ...base,
    lockVersion: 5,
    challengeMode: "flash",
    status: "completed",
    outcome: null,
    score: 50,
  },
};
const hashtagDefinition = definitionFor(
  sessionCases.find((row) => row.document.type === "word-hashtag")!,
);
const hashtagLevel = compileDefinition(hashtagDefinition).levels[0]!;
const hashtagChallenge: ServerFlashChallenge = {
  ...hashtagDefinition.challenge,
  mode: "flash",
  slots: hashtagDefinition.challenge.levels,
};
const hashtagProgress = formatProgress(hashtagLevel, initialFormatState(hashtagLevel)) as {
  letters: (string | null)[];
};
const hashtagAction = correctActions(hashtagLevel.question)[0]!;
if (hashtagAction.operation !== "wordHashtagSwap") throw new Error("expected_swap");
const swappedLetters = [...hashtagProgress.letters];
[swappedLetters[hashtagAction.input.fromCell], swappedLetters[hashtagAction.input.toCell]] = [
  swappedLetters[hashtagAction.input.toCell]!,
  swappedLetters[hashtagAction.input.fromCell]!,
];
const hashtagSwap = Object.freeze({
  ...base,
  lockVersion: 3,
  challengeItemId: hashtagLevel.source.challengeItemId,
  letters: Object.freeze(swappedLetters),
  correctCells: [],
  movesUsed: 1,
  movesRemaining: Number(hashtagLevel.publicPayload.maxMoves) - 1,
  terminal: false,
});
let hashtagMode = false;
let zeroSqlSwap = false;
let corruptSwap = false;
let lastSwapReply: { status: number; body: unknown } | undefined;
const activeChallenge = () => (hashtagMode ? hashtagChallenge : challenge);
let broken: string | undefined;
let loseAnswer = false;
let corruptComplete = false;
let invalidReview = false;
let engine: CompetitiveSessionEngine | undefined;
let requests: { operation: string; body: unknown }[];
let commands: SupabaseAttemptCommands;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at);
  vi.stubEnv("SUPABASE_DB_URL", "postgresql://authenticator:postgres@127.0.0.1:54322/postgres");
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  broken = undefined;
  hashtagMode = false;
  zeroSqlSwap = false;
  corruptSwap = false;
  lastSwapReply = undefined;
  loseAnswer = false;
  corruptComplete = false;
  invalidReview = false;
  requests = [];
  pg.query.mockReset();
  pg.release.mockReset();
  pg.query.mockImplementation(async (sql: string) => {
    if (sql.includes("expire_stale_attempts"))
      return { rows: [{ result: { abandonedAttempts: 0 } }] };
    if (sql.includes("private.prepare_interaction") && hashtagMode)
      return {
        rows: [
          {
            result: {
              ...fixtures.prepare_interaction,
              challengeItemId: hashtagLevel.source.challengeItemId,
              questionType: "word-hashtag",
              publicPayload: hashtagLevel.publicPayload,
              progress: hashtagProgress,
            },
          },
        ],
      };
    if (sql.includes("private.submit_word_hashtag_swap"))
      return {
        rows: [
          {
            result: zeroSqlSwap
              ? {
                  ...hashtagSwap,
                  movesUsed: 0,
                  movesRemaining: Number(hashtagLevel.publicPayload.maxMoves),
                }
              : hashtagSwap,
          },
        ],
      };
    if (sql.includes("as context") && hashtagMode)
      return {
        rows: [
          {
            context: {
              challengeItemId: hashtagLevel.source.challengeItemId,
              questionType: "word-hashtag",
              payloadSchemaVersion: 1,
              timeLimitMs: hashtagChallenge.slots[0]!.timeLimitMs,
              points: hashtagChallenge.slots[0]!.points,
              mode: "flash",
              globalTimeLimitMs: null,
              publicPayload: hashtagLevel.publicPayload,
            },
          },
        ],
      };
    if (sql.includes("as context"))
      return {
        rows: [
          {
            context: {
              challengeItemId: "item",
              questionType: "multiple-choice",
              payloadSchemaVersion: 1,
              timeLimitMs: 60000,
              points: 50,
              mode: "flash",
              globalTimeLimitMs: null,
              publicPayload: { question: "Elige", options: ["A", "B"] },
            },
          },
        ],
      };
    if (sql.includes("prepare_attempt_session")) return { rows: [{ result: "" }] };
    const name = Object.keys(fixtures).find((key) => sql.includes(`private.${key}(`));
    return {
      rows: name ? [{ result: name === broken ? { lockVersion: 4 } : fixtures[name] }] : [],
    };
  });
  commands = new SupabaseAttemptCommands({ authUserId: "actor" });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const operation = url.split("/").at(-1)!;
      const body = JSON.parse(String(init.body));
      requests.push({ operation, body });
      const input = {
        ...body,
        attemptId: "attempt",
        sessionToken: "private",
      } as AttemptCommandInput;
      try {
        if (operation === "session") {
          await commands.prepareSession({ scheduledChallengeId: "challenge" as never });
          return Response.json({ ready: true });
        }
        if (operation === "start") {
          const result = await commands.start({
            scheduledChallengeId: "challenge" as never,
            sessionToken: "private",
            idempotencyKey: body.idempotencyKey,
          });
          return Response.json({
            attemptId: result.attemptId,
            lockVersion: result.lockVersion,
            resumed: result.resumed,
            deadlineAt: result.deadlineAt,
          });
        }
        if (operation === "prepare") return Response.json(await commands.prepare(input));
        if (operation === "swap") {
          const result = await commands.submitWordHashtagSwap(input as SubmitWordHashtagSwapInput);
          const value = corruptSwap
            ? {
                ...result,
                movesUsed: 0,
                movesRemaining: Number(hashtagLevel.publicPayload.maxMoves),
              }
            : result;
          corruptSwap = false;
          lastSwapReply = { status: 200, body: structuredClone(value) };
          return Response.json(value);
        }
        if (operation === "complete") {
          const result = await commands.completeFromPersistedAnswers(input);
          return Response.json(
            corruptComplete
              ? { attemptId: result.attemptId, lockVersion: result.lockVersion }
              : {
                  ...result,
                  ...(invalidReview
                    ? {
                        review: [
                          { challengeItemId: "item", publicPayload: {}, solutionPayload: {} },
                        ],
                      }
                    : {}),
                },
          );
        }
        const received = await commands.receiveAnswer(input as SubmitAnswerInput);
        const evaluated = await commands.recordEvaluation({
          ...input,
          lockVersion: received.lockVersion,
          receiptId: received.receiptId,
          idempotencyKey: `evaluation:${received.receiptId}`,
          status: "correct",
          points: 50,
        });
        if (loseAnswer) {
          loseAnswer = false;
          return new Response("truncated", { status: 200 });
        }
        return Response.json({
          ...evaluated,
          challengeItemId: body.challengeItemId,
          timeUsedMs: received.timeUsedMs,
          timedOut: received.timedOut,
        });
      } catch (error) {
        const response = errorResponse(error, "response-contract", `competitive.${operation}`);
        if (operation === "swap")
          lastSwapReply = { status: response.status, body: await response.clone().json() };
        return response;
      }
    }),
  );
});
afterEach(() => {
  engine?.dispose();
  engine = undefined;
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const provider = () =>
  createRemoteGameSessionProvider({ context: sessionValidationContext(activeChallenge()) });
async function play() {
  engine = new CompetitiveSessionEngine({
    challenge: activeChallenge(),
    provider: provider(),
    initialSession: { status: "new", results: [], score: 0 },
  });
  await engine.lifecycle.begin();
  await engine.startQuestions();
  return engine;
}
function transactions() {
  return pg.query.mock.calls
    .map(([sql]) => String(sql))
    .filter((s) => s === "COMMIT" || s === "ROLLBACK");
}

describe("SQL decoder → HTTP → provider → engine", () => {
  it.each(["start_attempt", "prepare_interaction", "receive_answer", "record_evaluation"])(
    "normalizes malformed %s as uncertain, with rollback and no fabricated result",
    async (name) => {
      broken = name;
      const op =
        name === "start_attempt" ? "start" : name === "prepare_interaction" ? "prepare" : "answer";
      const result = await provider().execute(
        op === "start"
          ? { operation: op, input: { challengeId: "challenge", idempotencyKey: "key" } }
          : op === "prepare"
            ? { operation: op, input: { sessionId: "attempt", revision: 1, idempotencyKey: "key" } }
            : {
                operation: op,
                input: {
                  sessionId: "attempt",
                  revision: 2,
                  idempotencyKey: "key",
                  challengeItemId: "item",
                  answer: "A",
                },
              },
      );
      expect(result).toMatchObject({
        kind: "uncertain",
        code: "invalid_backend_response",
        retryable: true,
      });
      const response = (await (globalThis.fetch as ReturnType<typeof vi.fn>).mock.results.at(-1)!
        .value) as Response;
      expect(response.status).toBe(502);
      expect(transactions()).toEqual(
        name === "record_evaluation" ? ["COMMIT", "ROLLBACK"] : ["ROLLBACK"],
      );
      expect(result).not.toHaveProperty("state");
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"responsePath":'));
      expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining("private"));
    },
  );
  it("keeps a malformed preparation pending, blocks answers, and replays the same command", async () => {
    broken = "prepare_interaction";
    const e = await play();
    const pending = structuredClone(e.getSnapshot().pendingCommand);
    if (pending?.operation !== "prepare") throw new Error("Expected pending preparation");
    expect(e.getSnapshot()).toMatchObject({
      question: null,
      locked: true,
      attempt: { revision: 1 },
    });
    await e.interactions.submit("A");
    expect(requests.some((r) => r.operation === "answer")).toBe(false);
    broken = undefined;
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests.filter((r) => r.operation === "prepare").map((r) => r.body)).toEqual([
      expect.objectContaining({ idempotencyKey: pending!.input.idempotencyKey }),
      expect.objectContaining({ idempotencyKey: pending!.input.idempotencyKey }),
    ]);
    expect(e.getSnapshot()).toMatchObject({
      phase: "playing",
      pendingCommand: null,
      attempt: { revision: 2 },
    });
  });
  it("a response corrupted after both commits retains payload, version and key until exact replay", async () => {
    const e = await play();
    loseAnswer = true;
    await e.interactions.submit("A");
    const pending = structuredClone(e.getSnapshot().pendingCommand);
    if (pending?.operation !== "answer") throw new Error("Expected pending answer");
    expect(e.getSnapshot().results).toEqual([]);
    expect(transactions().slice(-2)).toEqual(["COMMIT", "COMMIT"]);
    await e.interactions.submit("B");
    await vi.advanceTimersByTimeAsync(1000);
    const answers = requests.filter((r) => r.operation === "answer");
    expect(answers).toHaveLength(2);
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[0].body).toMatchObject({
      answer: "A",
      lockVersion: pending!.input.revision,
      idempotencyKey: pending!.input.idempotencyKey,
    });
    expect(e.getSnapshot()).toMatchObject({
      pendingCommand: null,
      results: [{ points: 50, timeUsed: 1 }],
      attempt: { revision: 4 },
    });
  });
  it("bounds persistent malformed preparation and closure without replacing their commands", async () => {
    broken = "prepare_interaction";
    const e = await play();
    const preparation = structuredClone(e.getSnapshot().pendingCommand);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests.filter((r) => r.operation === "prepare")).toHaveLength(2);
    expect(e.getSnapshot().pendingCommand).toEqual(preparation);
    broken = undefined;
    await e.retry();
    const deadline = e.getSnapshot().questionDeadlineAt;
    corruptComplete = true;
    await e.lifecycle.complete();
    const completion = structuredClone(e.getSnapshot().pendingCommand);
    await vi.advanceTimersByTimeAsync(10_000);
    const closures = requests.filter((r) => r.operation === "complete");
    expect(closures).toHaveLength(4);
    expect(closures.every((r) => JSON.stringify(r) === JSON.stringify(closures[0]))).toBe(true);
    expect(e.getSnapshot()).toMatchObject({
      pendingCommand: completion,
      questionDeadlineAt: deadline,
      locked: true,
    });
    expect(e.getSnapshot().phase).not.toBe("results");
  });
  it("confirms completion even when the terminal review fails its format adapter", async () => {
    const e = await play();
    invalidReview = true;
    await e.lifecycle.complete();
    expect(e.getSnapshot()).toMatchObject({
      phase: "results",
      score: 50,
      lifecycleError: { code: "review_pending" },
      pendingCommand: null,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests.filter((r) => r.operation === "complete")).toHaveLength(1);
  });
});

describe("Hashtag zero-move confirmation across boundaries", () => {
  it.each(["sql", "http"] as const)(
    "retains the original command when a zero-move response is detected at %s",
    async (boundary) => {
      hashtagMode = true;
      const e = await play();
      const original = JSON.stringify(hashtagSwap);
      zeroSqlSwap = boundary === "sql";
      corruptSwap = boundary === "http";
      pg.query.mockClear();
      requests.length = 0;
      const before = structuredClone(e.getSnapshot());
      await e.interactions.submitWordHashtagSwap(
        hashtagAction.input.fromCell,
        hashtagAction.input.toCell,
      );
      expect(e.getSnapshot()).toMatchObject({
        locked: true,
        pendingCommand: { operation: "wordHashtagSwap" },
        commandStatus: "uncertain",
        attempt: before.attempt,
        question: before.question,
        results: [],
      });
      expect(transactions()).toEqual([boundary === "sql" ? "ROLLBACK" : "COMMIT"]);
      if (boundary === "sql")
        expect(lastSwapReply).toMatchObject({
          status: 502,
          body: { error: { code: "invalid_backend_response" } },
        });
      else expect(lastSwapReply).toMatchObject({ status: 200, body: { movesUsed: 0 } });
      zeroSqlSwap = false;
      await vi.advanceTimersByTimeAsync(1000);
      const swaps = requests.filter((request) => request.operation === "swap");
      expect(swaps).toHaveLength(2);
      expect(swaps[1]).toEqual(swaps[0]);
      expect(transactions()).toEqual([boundary === "sql" ? "ROLLBACK" : "COMMIT", "COMMIT"]);
      expect(e.getSnapshot()).toMatchObject({
        pendingCommand: null,
        attempt: { revision: 3 },
        question: {
          progress: { movesUsed: 1, swaps: [hashtagAction.input] },
        },
      });
      expect(lastSwapReply).toEqual({ status: 200, body: hashtagSwap });
      expect(JSON.stringify(hashtagSwap)).toBe(original);
      await e.retry();
      expect(requests.filter((request) => request.operation === "swap")).toHaveLength(2);
    },
  );
});
