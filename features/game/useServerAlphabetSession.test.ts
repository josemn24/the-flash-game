import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameRoomContext } from "@/types/view-models/room";
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("react", () => ({
  useSyncExternalStore(_subscribe: unknown, snapshot: () => unknown) {
    return snapshot();
  },
  useMemo(factory: () => unknown) {
    const index = hookHarness.cursor++;
    if (!hookHarness.slots[index]) hookHarness.slots[index] = { kind: "memo", value: factory() };
    return hookHarness.slots[index].value;
  },
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

afterEach(() => {
  vi.unstubAllGlobals();
  hookHarness.slots = [];
  hookHarness.cursor = 0;
  hookHarness.pendingEffects = [];
});

describe("useServerAlphabetSession timeout finalization", () => {
  it("finishes all remaining letters through complete and hydrates the full result", async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        paths.push(path);
        if (path.endsWith("/start"))
          return jsonResponse({ attemptId: "attempt-1", lockVersion: 1 });
        if (path.endsWith("/prepare"))
          return jsonResponse({
            challengeItemId: "item-A",
            lockVersion: 2,
            publicPayload: { question: "Animal" },
            deadlineAt: new Date(Date.now() + 135000).toISOString(),
            timedOut: false,
            progress: { kind: "alphabet", letters: [], round: 1, correctAnswers: 0 },
          });
        if (path.endsWith("/complete"))
          return jsonResponse({
            lockVersion: 3,
            score: 0,
            review: [],
            answers: challenge.entries.map((entry) => ({
              challengeItemId: entry.id,
              answer: null,
              status: "unanswered",
              points: 0,
              timeUsedMs: 0,
            })),
          });
        throw new Error(`Unexpected endpoint: ${path}`);
      }),
    );
    let session = renderSessionHook();
    await session.begin();
    await session.startQuestions();
    session = renderSessionHook();
    await Promise.all([session.onTimeUp(), session.onTimeUp()]);
    session = renderSessionHook();
    expect(session.phase).toBe("results");
    expect(session.results).toHaveLength(3);
    expect(paths.filter((path) => path.endsWith("/complete"))).toHaveLength(1);
    expect(paths.filter((path) => path.endsWith("/answer"))).toHaveLength(0);
  });

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
    expect(session.locked).toBe(true);
    expect(calls.filter((path) => path.endsWith("/alphabet/pass"))).toHaveLength(1);
  });
});
