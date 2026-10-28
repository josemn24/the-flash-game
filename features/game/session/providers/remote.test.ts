import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import { CompetitiveCommandError } from "../../competitive/transport";
import { createCompetitiveAttemptClient } from "../../competitive/attemptClient";
import { createRemoteGameSessionProvider } from "./remote";

afterEach(() => vi.unstubAllGlobals());

const context = { sessionId: "session", revision: 7 };
const mutation = { ...context, idempotencyKey: "original-key" };
const interaction = { ...mutation, challengeItemId: "item" };
const commands: readonly [GameSessionCommand, string, object][] = [
  [
    { operation: "prepareSession", input: { challengeId: "challenge" } },
    "session",
    { scheduledChallengeId: "challenge" },
  ],
  [
    { operation: "start", input: { challengeId: "challenge", idempotencyKey: "original-key" } },
    "start",
    { scheduledChallengeId: "challenge", idempotencyKey: "original-key" },
  ],
  [
    { operation: "takeover", input: { ...mutation, challengeId: "challenge" } },
    "session/takeover",
    { scheduledChallengeId: "challenge" },
  ],
  [{ operation: "recover", input: context }, "session/recover", {}],
  [{ operation: "prepare", input: mutation }, "session/prepare", {}],
  [{ operation: "activate", input: interaction }, "session/activate", { challengeItemId: "item" }],
  [
    { operation: "answer", input: { ...interaction, answer: null } },
    "session/answer",
    { challengeItemId: "item", answer: null },
  ],
  [
    { operation: "alphabetPass", input: interaction },
    "session/alphabet/pass",
    { challengeItemId: "item" },
  ],
  [{ operation: "complete", input: mutation }, "session/complete", {}],
  [{ operation: "abandon", input: context }, "session/abandon", { confirm: true }],
  [
    { operation: "miniWordleGuess", input: { ...interaction, guess: "CASA" } },
    "session/mini-wordle/guess",
    { challengeItemId: "item", guess: "CASA" },
  ],
  [
    { operation: "logicCodeAttempt", input: { ...interaction, code: "1234" } },
    "session/logic-code/attempt",
    { challengeItemId: "item", code: "1234" },
  ],
  [
    { operation: "wordHashtagSwap", input: { ...interaction, fromCell: 1, toCell: 2 } },
    "session/word-hashtag/swap",
    { challengeItemId: "item", fromCell: 1, toCell: 2 },
  ],
  [
    { operation: "progressiveClueReveal", input: interaction },
    "session/progressive-clues/reveal",
    { challengeItemId: "item" },
  ],
  [
    { operation: "queensDraft", input: { ...interaction, queens: [1, 2] } },
    "session/queens/draft",
    { challengeItemId: "item", queens: [1, 2] },
  ],
  [
    { operation: "queensValidation", input: { ...interaction, queens: [1, 2] } },
    "session/queens/validate",
    { challengeItemId: "item", queens: [1, 2] },
  ],
  [
    { operation: "wordSearchSelection", input: { ...interaction, startCell: 1, endCell: 2 } },
    "session/word-search/select",
    { challengeItemId: "item", startCell: 1, endCell: 2 },
  ],
];

describe("remote session wire compatibility", () => {
  it.each([400, 409, 422, 503])(
    "normalizes unknown or missing HTTP %i codes explicitly",
    async (status) => {
      for (const code of ["future_error", "competitive_command_failed"]) {
        const client = createCompetitiveAttemptClient();
        client.prepare = vi.fn(async () => {
          throw new CompetitiveCommandError(code, status);
        });
        const result = await createRemoteGameSessionProvider({ client }).execute({
          operation: "prepare",
          input: mutation,
        });
        expect(result).toMatchObject(
          status < 500
            ? { code: "unknown_rejection", kind: "rejected", retryable: false }
            : { code: "command_failed", kind: "uncertain", retryable: true },
        );
      }
    },
  );

  it.each([400, 422, 503])(
    "handles an unreadable HTTP %i error body conservatively",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("unreadable", { status })),
      );
      const result = await createRemoteGameSessionProvider().execute({
        operation: "prepare",
        input: mutation,
      });
      expect(result).toMatchObject(
        status < 500
          ? { code: "unknown_rejection", kind: "rejected", retryable: false }
          : { code: "command_failed", kind: "uncertain", retryable: true },
      );
    },
  );

  it.each(commands)(
    "maps $0.operation to the existing endpoint and body",
    async (command, path, extra) => {
      const fetch = vi.fn(async () => Response.json({ attemptId: "session", lockVersion: 8 }));
      vi.stubGlobal("fetch", fetch);
      const result = await createRemoteGameSessionProvider().execute(command);
      expect(result.kind).toBe("accepted");
      const [url, request] = fetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(`/api/competitive/attempts/${path}`);
      const body = JSON.parse(String(request.body));
      const hasSession = "sessionId" in command.input;
      expect(body).toEqual({
        ...(hasSession ? { lockVersion: 7 } : {}),
        ...("idempotencyKey" in command.input ? { idempotencyKey: "original-key" } : {}),
        ...extra,
      });
      expect(body).not.toHaveProperty("sessionId");
      expect(body).not.toHaveProperty("revision");
    },
  );

  it("keeps the key, payload and revision identical after an uncertain delivery", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection lost"))
      .mockResolvedValueOnce(Response.json({ lockVersion: 8, status: "correct", points: 10 }));
    vi.stubGlobal("fetch", fetch);
    const provider = createRemoteGameSessionProvider();
    const command: GameSessionCommand = {
      operation: "answer",
      input: { ...interaction, answer: "A" },
    };
    expect(await provider.execute(command)).toMatchObject({ kind: "uncertain", retryable: true });
    expect(await provider.execute(command)).toMatchObject({
      kind: "accepted",
      effect: "evaluated",
      state: { revision: 8 },
    });
    expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
    expect(command.input).toEqual({ ...interaction, answer: "A" });
  });

  it.each([
    ["rate_limited", 429, 4, "rejected", true],
    ["stale_version", 409, undefined, "rejected", false],
    ["queens_answer_incomplete", 400, undefined, "rejected", false],
    ["request_timeout", 0, undefined, "uncertain", true],
    ["invalid_json_response", 200, undefined, "uncertain", true],
    ["database_unavailable", 503, undefined, "uncertain", true],
  ] as const)(
    "normalizes %s without exposing HTTP status",
    async (code, status, retryAfter, kind, retryable) => {
      const client = createCompetitiveAttemptClient();
      client.prepare = vi.fn(async () => {
        throw new CompetitiveCommandError(code, status, retryAfter);
      });
      const result = await createRemoteGameSessionProvider({ client }).execute({
        operation: "prepare",
        input: mutation,
      });
      expect(result).toMatchObject({ kind, code, retryable, retryAfterSeconds: retryAfter });
      expect(result).not.toHaveProperty("status");
      expect(result).not.toHaveProperty("details");
    },
  );

  it("propagates cancellation to the real transport", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const controller = new AbortController();
    const pending = createRemoteGameSessionProvider().execute(
      { operation: "prepare", input: mutation },
      { signal: controller.signal },
    );
    controller.abort();
    expect(await pending).toMatchObject({ kind: "uncertain", code: "request_cancelled" });
  });
});

describe("remote session projections", () => {
  it.each([
    ["queensValidation", false, "progress"],
    ["queensValidation", true, "evaluated"],
    ["queensDraft", false, "progress"],
    ["answer", undefined, "evaluated"],
    ["complete", undefined, "completed"],
  ] as const)(
    "distinguishes %s terminal=%s from session completion",
    async (operation, terminal, effect) => {
      const client = createCompetitiveAttemptClient();
      const response = {
        lockVersion: 8,
        terminal,
        status: "incorrect",
        review: [
          { challengeItemId: "item", publicPayload: {}, solutionPayload: { answer: "secret" } },
        ],
        solutionPayload: { answer: "secret" },
        sessionToken: "secret",
      };
      client[operation] = vi.fn(async () => response);
      const command = {
        operation,
        input: { ...interaction, queens: [], answer: null },
      } as GameSessionCommand;
      const result = await createRemoteGameSessionProvider({ client }).execute(command);
      expect(result).toMatchObject({ kind: "accepted", effect });
      if (result.kind !== "accepted") throw new Error(result.code);
      expect(result.state).not.toHaveProperty("review");
      expect(result.state).not.toHaveProperty("solutionPayload");
      expect(result.state).not.toHaveProperty("sessionToken");
      if (effect === "completed") expect(result.review).toEqual(response.review);
      else expect(result).not.toHaveProperty("review");
    },
  );

  it("normalizes recovered receipts and exposes review only after terminal recovery", async () => {
    const client = createCompetitiveAttemptClient();
    client.recover = vi.fn(async () => ({
      lockVersion: 8,
      phase: "results",
      score: 12,
      answers: [
        { challengeItemId: "item", answer: "A", status: "correct", points: 12, timeUsedMs: 1250 },
      ],
      review: [],
    }));
    const result = await createRemoteGameSessionProvider({ client }).execute({
      operation: "recover",
      input: context,
    });
    expect(result).toMatchObject({
      kind: "accepted",
      effect: "completed",
      review: [],
      state: {
        answers: [
          {
            questionId: "item",
            answer: "A",
            status: "correct",
            isCorrect: true,
            points: 12,
            timeUsed: 1.25,
          },
        ],
      },
    });
  });

  it("keeps takeover metadata separate from private transport details", async () => {
    const client = createCompetitiveAttemptClient();
    client.start = vi.fn(async () => {
      throw new CompetitiveCommandError("attempt_control_required", 409, undefined, {
        attempt: { attemptId: "session", lockVersion: 7, deadlineAt: null },
        sessionToken: "secret",
      });
    });
    expect(
      await createRemoteGameSessionProvider({ client }).execute({
        operation: "start",
        input: { challengeId: "challenge", idempotencyKey: "key" },
      }),
    ).toEqual({
      kind: "rejected",
      code: "attempt_control_required",
      retryable: false,
      authorizationLost: false,
      retryAfterSeconds: undefined,
      controlRequired: { sessionId: "session", revision: 7, deadlineAt: null },
    });
  });
});
