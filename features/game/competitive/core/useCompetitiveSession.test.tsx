// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import { definitionFor, sessionCases } from "@/test-utils/game-session-conformance/corpus";
import { useCompetitiveSessionWithProvider } from "./useCompetitiveSession";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);
const challenge = definitionFor(sessionCases[0]!).challenge;
const initialSession = { status: "new" as const, results: [], score: 0 };
const ready: GameSessionResult = {
  kind: "accepted",
  effect: "acknowledged",
  state: { ready: true },
};

it("retains the engine and its in-flight command when only the options object is recreated", async () => {
  let resolve!: (result: GameSessionResult) => void;
  let signal: AbortSignal | undefined;
  const execute = vi.fn<GameSessionProvider["execute"]>((_command, options) => {
    signal = options?.signal;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const provider: GameSessionProvider = { execute };
  const hook = renderHook(() =>
    useCompetitiveSessionWithProvider({ challenge, provider, initialSession }),
  );
  const begin = hook.result.current.begin;
  let pending!: Promise<void>;
  await act(async () => {
    pending = begin();
    await Promise.resolve();
  });
  hook.rerender();
  expect(hook.result.current.begin).toBe(begin);
  expect(signal?.aborted).toBe(false);
  expect(execute).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ kind: "rejected", code: "publication_not_open", retryable: false });
    await pending;
  });
});

it.each(["provider", "challenge", "unmount"])(
  "invalidates an old command after %s and ignores its late response",
  async (change) => {
    let resolve!: (result: GameSessionResult) => void;
    let signal: AbortSignal | undefined;
    const execute = vi.fn<GameSessionProvider["execute"]>((_command, options) => {
      signal = options?.signal;
      return new Promise((done) => {
        resolve = done;
      });
    });
    const provider: GameSessionProvider = { execute };
    const nextProvider: GameSessionProvider = { execute: vi.fn(async () => ready) };
    const hook = renderHook(
      (props) => useCompetitiveSessionWithProvider({ ...props, initialSession }),
      {
        initialProps: { provider, challenge },
      },
    );
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.result.current.begin();
      await Promise.resolve();
    });
    if (change === "unmount") hook.unmount();
    else
      hook.rerender({
        provider: change === "provider" ? nextProvider : provider,
        challenge: change === "challenge" ? { ...challenge, id: "another" } : challenge,
      });
    await act(async () => {
      await Promise.resolve();
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve(ready);
      await pending;
    });
    expect(execute).toHaveBeenCalledTimes(1);
    if (change !== "unmount") expect(hook.result.current.phase).toBe("intro");
  },
);
