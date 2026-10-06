import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerFlashChallenge, ServerNarrativeChallenge } from "@/types/gameplay/challenge";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => void>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("react", () => {
  const memo = (factory: () => unknown) => {
    const index = harness.cursor++;
    return (harness.slots[index] ??= factory());
  };
  return {
    useMemo: memo,
    useCallback: (callback: unknown) => memo(() => callback),
    useEffectEvent: (callback: unknown) => callback,
    useRef: (value: unknown) => memo(() => ({ current: value })),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots))
        harness.slots[index] =
          typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [
        harness.slots[index],
        (next: unknown) => {
          harness.slots[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(harness.slots[index])
              : next;
        },
      ];
    },
    useReducer: (reducer: (state: unknown, event: unknown) => unknown, initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (event: unknown) => {
          harness.slots[index] = reducer(harness.slots[index], event);
        },
      ];
    },
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    useEffect: (effect: () => void, deps: readonly unknown[]) => {
      const index = harness.cursor++;
      const previous = harness.slots[index] as readonly unknown[] | undefined;
      if (!previous || deps.some((value, position) => previous[position] !== value)) {
        harness.slots[index] = deps;
        harness.effects.push(effect);
      }
    },
  };
});
import { useServerFlashSession } from "../useServerFlashSessionController";
import { useServerNarrativeSession } from "../useServerNarrativeSession";

const roomContext = { attemptStatus: null, result: null } as unknown as GameRoomContext;
const slot = {
  id: "item",
  position: 1,
  questionType: "mini-wordle",
  payloadSchemaVersion: 1,
  timeLimitMs: 60_000,
  points: 10,
} as const;
const base = {
  id: "challenge",
  definitionId: "definition",
  number: 1,
  title: "Test",
  subtitle: "",
  description: "",
  maxScore: 10,
};
function render<T>(hook: () => T) {
  harness.cursor = 0;
  const result = hook();
  harness.effects.splice(0).forEach((effect) => effect());
  return result;
}
const json = (value: object, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  harness.slots = [];
  harness.effects = [];
});

beforeEach(() => vi.useFakeTimers());

describe("competitive facade regressions", () => {
  it("uses the version returned by a partial Mini-Wordle guess for the timeout answer", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        if (url.endsWith("/session")) return json({ ready: true });
        if (url.endsWith("/start")) return json({ attemptId: "attempt", lockVersion: 1 });
        if (url.endsWith("/prepare"))
          return json({
            challengeItemId: "item",
            lockVersion: 2,
            presentedAt: new Date().toISOString(),
            deadlineAt: new Date(Date.now() + 60000).toISOString(),
            publicPayload: { question: "Palabra", wordLength: 4, maxAttempts: 6, hint: "" },
          });
        if (url.endsWith("/guess"))
          return json({
            lockVersion: 3,
            guess: "CASA",
            attemptsUsed: 1,
            feedback: [],
            terminal: false,
          });
        bodies.push(body);
        return json({ lockVersion: 4, status: "unanswered", points: 0, timeUsedMs: 60000 });
      }),
    );
    const challenge: ServerFlashChallenge = { ...base, mode: "flash", slots: [slot] };
    const useTestSession = () => useServerFlashSession({ challenge, roomContext });
    await render(useTestSession).begin();
    await render(useTestSession).startQuestions();
    await render(useTestSession).submitMiniWordleGuess("CASA");
    render(useTestSession).handleTimeUp();
    for (let index = 0; index < 20; index++) await Promise.resolve();
    expect(bodies[0]?.lockVersion).toBe(3);
  });

  it("reuses the complete original Narrative command after losing its response", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/session")) return json({ ready: true });
        if (url.endsWith("/start")) return json({ attemptId: "attempt", lockVersion: 1 });
        if (url.endsWith("/prepare"))
          return json({
            challengeItemId: "item",
            lockVersion: 2,
            publicPayload: { question: "Elige", options: ["A", "B"] },
            presentedAt: new Date().toISOString(),
            deadlineAt: new Date(Date.now() + 60000).toISOString(),
          });
        bodies.push(JSON.parse(String(init.body)));
        throw new TypeError("lost response");
      }),
    );
    const challenge = {
      ...base,
      mode: "narrative",
      prologue: {
        id: "prologue",
        title: "Inicio",
        blocks: [{ type: "narration", text: "Inicio" }],
      },
      beats: [{ id: "beat", title: "", steps: [{ type: "question", questionId: "item" }] }],
      slots: [{ ...slot, questionType: "multiple-choice" }],
    } as ServerNarrativeChallenge;
    const useTestSession = () => useServerNarrativeSession({ challenge, roomContext });
    await render(useTestSession).begin();
    await render(useTestSession).continueScene();
    await render(useTestSession).submit("A");
    render(useTestSession).retrySubmit();
    for (let index = 0; index < 20; index++) await Promise.resolve();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });
});
