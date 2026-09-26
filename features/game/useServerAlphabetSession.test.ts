import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameRoomContext } from "@/types/game";
import type { ServerAlphabetChallenge } from "@/types/gameplay/challenge";

type TestHookSlot = {
  kind: string;
  value?: unknown;
  deps?: readonly unknown[];
};

const hookHarness = vi.hoisted(() => ({
  slots: [] as TestHookSlot[],
  cursor: 0,
  pendingEffects: [] as Array<() => void>,
}));

vi.mock("react", () => ({
  useState(initial: unknown) {
    const index = hookHarness.cursor++;
    let slot = hookHarness.slots[index];
    if (!slot) {
      slot = {
        kind: "state",
        value: typeof initial === "function" ? (initial as () => unknown)() : initial,
      };
      hookHarness.slots[index] = slot;
    }
    return [
      slot.value,
      (next: unknown) => {
        slot!.value =
          typeof next === "function" ? (next as (value: unknown) => unknown)(slot!.value) : next;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = hookHarness.cursor++;
    let slot = hookHarness.slots[index];
    if (!slot) {
      slot = { kind: "ref", value: { current: initial } };
      hookHarness.slots[index] = slot;
    }
    return slot.value;
  },
  useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]) {
    const index = hookHarness.cursor++;
    const previous = hookHarness.slots[index];
    const changed =
      !previous ||
      !dependencies ||
      dependencies.some((value, item) => value !== previous.deps?.[item]);
    if (changed) {
      hookHarness.slots[index] = { kind: "effect", deps: dependencies };
      hookHarness.pendingEffects.push(effect);
    }
  },
}));

import { useServerAlphabetSession } from "./useServerAlphabetSession";

const challenge = {
  id: "challenge-1",
  definitionId: "definition-1",
  number: 1,
  title: "Reino animal",
  subtitle: "Alphabet",
  description: "Responde las letras",
  mode: "alphabet",
  timeLimitMs: 135_000,
  maxScore: 100,
  entries: ["A", "B", "C"].map((letter, index) => ({
    id: `item-${letter}`,
    position: index + 1,
    letter,
    questionType: "short-text",
    payloadSchemaVersion: 1,
    timeLimitMs: 135_000,
    points: index === 0 ? 6 : 5,
  })),
} as ServerAlphabetChallenge;

const roomContext = { attemptStatus: null, result: null } as unknown as GameRoomContext;

function renderSessionHook() {
  hookHarness.cursor = 0;
  // This hook is invoked by the lightweight test harness below, not during application rendering.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useServerAlphabetSession({ challenge, roomContext });
  const effects = hookHarness.pendingEffects.splice(0);
  effects.forEach((effect) => effect());
  return result;
}

function jsonResponse(value: Record<string, unknown>, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function drainMicrotasks() {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  hookHarness.slots = [];
  hookHarness.cursor = 0;
  hookHarness.pendingEffects = [];
});

describe("useServerAlphabetSession timeout finalization", () => {
  it.each(["401", "network"] as const)(
    "recovers once after a %s and finalizes the remaining letters without duplicate timeouts",
    async (failure) => {
      const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
      const answerFailures = new Set(["item-B"]);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          calls.push({ path, body });

          if (path.endsWith("/start"))
            return jsonResponse({ attemptId: "attempt-1", lockVersion: 1 });
          if (path.endsWith("/recover")) return jsonResponse({ phase: "prepare", lockVersion: 2 });
          if (path.endsWith("/prepare")) {
            const prepareCount = calls.filter((call) => call.path.endsWith("/prepare")).length;
            if (prepareCount <= 2) {
              return jsonResponse({
                challengeItemId: prepareCount === 1 ? "item-A" : "item-B",
                lockVersion: prepareCount,
                deadlineAt: new Date(Date.now() + 135_000).toISOString(),
                publicPayload: { question: "Mamífero con placas óseas" },
                timedOut: false,
                progress: { kind: "alphabet", letters: [], round: 1, correctAnswers: 0 },
              });
            }
            const itemId = prepareCount === 3 ? "item-B" : "item-C";
            return jsonResponse({
              challengeItemId: itemId,
              lockVersion: prepareCount + 1,
              deadlineAt: new Date(Date.now() - 1).toISOString(),
              publicPayload: null,
              timedOut: true,
              progress: { kind: "alphabet", letters: [], round: 1, correctAnswers: 1 },
            });
          }
          if (path.endsWith("/answer")) {
            const itemId = String(body.challengeItemId);
            if (itemId === "item-B" && answerFailures.delete(itemId)) {
              if (failure === "network") throw new TypeError("Network failure");
              return jsonResponse({ error: { code: "attempt_session_missing" } }, 401);
            }
            return jsonResponse({
              status: itemId === "item-A" ? "correct" : "unanswered",
              points: itemId === "item-A" ? 6 : 0,
              timeUsedMs: itemId === "item-A" ? 1_000 : 135_000,
              lockVersion: Number(body.lockVersion) + 1,
            });
          }
          if (path.endsWith("/complete")) return jsonResponse({ score: 6, review: [] });
          throw new Error(`Unexpected endpoint: ${path}`);
        }),
      );

      let session = renderSessionHook();
      await session.begin();
      session = renderSessionHook();
      await session.startQuestions();
      session = renderSessionHook();
      await session.submit("armadillo");
      session = renderSessionHook();

      session.onTimeUp();
      session.onTimeUp();
      await drainMicrotasks();
      session = renderSessionHook();

      expect(session.phase).toBe("results");
      expect(session.score).toBe(6);
      expect(session.results).toHaveLength(3);
      expect(session.results.map((result) => result.questionId)).toEqual([
        "item-A",
        "item-B",
        "item-C",
      ]);
      expect(calls.filter((call) => call.path.endsWith("/recover"))).toHaveLength(1);
      expect(calls.filter((call) => call.path.endsWith("/complete"))).toHaveLength(1);
      expect(
        calls.filter(
          (call) => call.path.endsWith("/answer") && call.body.challengeItemId === "item-B",
        ),
      ).toHaveLength(2);
    },
  );

  it("shows the server retry delay after a rate-limited pass", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        calls.push(path);
        if (path.endsWith("/start"))
          return jsonResponse({ attemptId: "attempt-1", lockVersion: 1 });
        if (path.endsWith("/prepare")) {
          return jsonResponse({
            challengeItemId: "item-A",
            lockVersion: 1,
            deadlineAt: new Date(Date.now() + 135_000).toISOString(),
            publicPayload: { question: "Mamífero" },
            timedOut: false,
            progress: { kind: "alphabet", letters: [], round: 1, correctAnswers: 0 },
          });
        }
        if (path.endsWith("/alphabet/pass")) {
          return jsonResponse({ error: { code: "rate_limited", requestId: "request-429" } }, 429, {
            "Retry-After": "4",
          });
        }
        throw new Error(`Unexpected endpoint: ${path}`);
      }),
    );

    let session = renderSessionHook();
    await session.begin();
    session = renderSessionHook();
    await session.startQuestions();
    session = renderSessionHook();
    await session.pass();
    session = renderSessionHook();

    expect(session.error).toBe(
      "Demasiadas solicitudes. Espera 4 segundos antes de volver a intentarlo.",
    );
    expect(session.locked).toBe(false);
    expect(calls.filter((path) => path.endsWith("/alphabet/pass"))).toHaveLength(1);
  });

  it("leaves a manual recovery action after automatic recovery also fails", async () => {
    let recoveryAttempts = 0;
    let failTimeoutAnswer = true;
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        calls.push({ path, body });
        if (path.endsWith("/start")) {
          recoveryAttempts += 1;
          if (recoveryAttempts === 2) throw new TypeError("Network failure");
          return jsonResponse({ attemptId: "attempt-1", lockVersion: 1 });
        }
        if (path.endsWith("/prepare")) {
          const prepareCount = calls.filter((call) => call.path.endsWith("/prepare")).length;
          const itemId = ["item-A", "item-A", "item-B", "item-C"][prepareCount - 1] ?? "item-C";
          return jsonResponse({
            challengeItemId: itemId,
            lockVersion: prepareCount,
            deadlineAt: new Date(Date.now() - 1).toISOString(),
            publicPayload: prepareCount === 1 ? { question: "Mamífero" } : null,
            timedOut: prepareCount > 1,
            progress: { kind: "alphabet", letters: [], round: 1, correctAnswers: 0 },
          });
        }
        if (path.endsWith("/answer")) {
          if (body.challengeItemId === "item-A" && failTimeoutAnswer) {
            failTimeoutAnswer = false;
            return jsonResponse({ error: { code: "attempt_session_missing" } }, 401);
          }
          return jsonResponse({
            status: "unanswered",
            points: 0,
            timeUsedMs: 135_000,
            lockVersion: Number(body.lockVersion) + 1,
          });
        }
        if (path.endsWith("/recover")) return jsonResponse({ phase: "prepare", lockVersion: 2 });
        if (path.endsWith("/complete")) return jsonResponse({ score: 0, review: [] });
        throw new Error(`Unexpected endpoint: ${path}`);
      }),
    );

    let session = renderSessionHook();
    await session.begin();
    session = renderSessionHook();
    await session.startQuestions();
    session = renderSessionHook();
    session.onTimeUp();
    await drainMicrotasks();
    session = renderSessionHook();

    expect(session.phase).toBe("recovering");
    expect(session.startNotice).toMatch(/Puedes reintentarlo/);
    expect(session.locked).toBe(true);

    session.retryRecovery();
    await drainMicrotasks();
    expect(recoveryAttempts).toBe(3);
  });
});
