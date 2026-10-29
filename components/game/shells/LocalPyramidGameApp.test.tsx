import { testSessionProvider } from "@/test-utils/sessionProvider";
// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { PyramidGameView } from "../modes/flash-pop/PyramidGameView";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import {
  correctActions,
  definitionFor,
  resolvedFor,
  sessionCases,
} from "@/test-utils/game-session-conformance/corpus";
import { LocalPyramidGameApp } from "./LocalPyramidGameApp.client";

const mocks = vi.hoisted(() => ({
  view: vi.fn(),
  originalProvider: undefined as unknown as typeof createLocalPyramidSessionProvider,
}));
vi.mock("../modes/flash-pop/PyramidGameView", () => ({
  PyramidGameView(props: Parameters<typeof PyramidGameView>[0]) {
    mocks.view(props);
    return <p data-testid="shared-view">{props.session.phase}</p>;
  },
}));
vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
vi.mock("@/features/game/session/providers/localPyramid", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/game/session/providers/localPyramid")>();
  mocks.originalProvider = original.createLocalPyramidSessionProvider;
  return {
    ...original,
    createLocalPyramidSessionProvider: vi.fn(original.createLocalPyramidSessionProvider),
  };
});
const view = () => mocks.view.mock.lastCall![0] as Parameters<typeof PyramidGameView>[0];
const session = () => view().session;
const definition = definitionFor(sessionCases[0]!);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function begin() {
  await act(async () => {
    await session().begin();
  });
  expect(session().phase).toBe("briefing");
}
async function open() {
  await act(async () => {
    await session().startQuestions();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
  expect(session().phase).toBe("playing");
}
async function answer(correct = true) {
  const index = session().questionIndex;
  const action = correctActions(resolvedFor(definition, index))[0]!;
  if (action.operation !== "answer") throw new Error("Expected generic fixture");
  await act(async () => {
    await session().submit(correct ? action.input.answer : "incorrecta");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createLocalPyramidSessionProvider).mockImplementation(mocks.originalProvider);
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(
    (callback) => setTimeout(() => callback(Date.now()), 0) as unknown as number,
  );
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => clearTimeout(id));
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("canonical local Pyramid composition", () => {
  it.each([true, false])(
    "reports confirmed terminal completion once (summit=%s), including review and replay",
    async (summit) => {
      const onComplete = vi.fn();
      render(
        <LocalPyramidGameApp definition={definition} onComplete={onComplete} returnTo="/volver" />,
      );
      expect(view().returnTo).toBe("/volver");
      expect(view()).not.toHaveProperty("definition");
      expect(JSON.stringify(view().challenge)).not.toContain("correctAnswer");
      expect(onComplete).not.toHaveBeenCalled();
      await begin();
      const startedAt = new Date().toISOString();
      for (let index = 0; index < (summit ? 7 : 1); index++) {
        await open();
        await answer(summit);
      }
      expect(session().phase).toBe("results");
      expect(session().pyramidProgress.outcome).toBe(summit ? "summit" : "failed");
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          challengeId: definition.challenge.id,
          completed: true,
          startedAt,
          flashPoints: session().score,
          answers: session().results,
          durationMs: session().results.reduce((sum, answer) => sum + answer.timeUsed * 1000, 0),
        }),
      );
      act(() => session().showReview());
      act(() => session().showResults());
      expect(onComplete).toHaveBeenCalledTimes(1);
      act(() => view().onReplay!());
      expect(session().phase).toBe("intro");
      await begin();
      await open();
      await answer(false);
      expect(onComplete).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps a run on ordinary rerenders and replaces it for a different challenge or version", async () => {
    const app = render(<LocalPyramidGameApp definition={definition} />);
    expect(view().returnTo).toBe("/demo/flash-pop");
    await begin();
    const id = session().attempt!.id;
    app.rerender(<LocalPyramidGameApp definition={structuredClone(definition)} />);
    expect(session().attempt!.id).toBe(id);
    expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(1);
    const changed = { ...definition, challenge: { ...definition.challenge, attemptVersion: 2 } };
    app.rerender(<LocalPyramidGameApp definition={changed} />);
    expect(session().phase).toBe("intro");
    await begin();
    expect(session().attempt!.id).not.toBe(id);
    app.rerender(
      <LocalPyramidGameApp
        definition={{ ...changed, challenge: { ...changed.challenge, id: "another" } }}
      />,
    );
    expect(session().phase).toBe("intro");
    expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(3);
  });

  it("does not report an unconfirmed completion or an abandoned attempt", async () => {
    const factory = vi.mocked(createLocalPyramidSessionProvider);
    const original = mocks.originalProvider;
    const pending = deferred<Awaited<ReturnType<GameSessionProvider["execute"]>>>();
    factory.mockImplementationOnce((options) => {
      const authority = original(options);
      return testSessionProvider((command, execution) =>
        command.operation === "complete" ? pending.promise : authority.execute(command, execution),
      );
    });
    const onComplete = vi.fn();
    render(<LocalPyramidGameApp definition={definition} onComplete={onComplete} />);
    await begin();
    await open();
    await answer(false);
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve({
        kind: "accepted",
        operation: "complete",
        effect: "completed",
        state: {
          sessionId: "local",
          revision: 1,
          status: "abandoned",
          score: 0,
          phase: "results",
          answers: session().results,
        },
      });
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("survives StrictMode without reporting before play", () => {
    const onComplete = vi.fn();
    render(
      <StrictMode>
        <LocalPyramidGameApp definition={definition} onComplete={onComplete} />
      </StrictMode>,
    );
    expect(session().phase).toBe("intro");
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("Mini-Wordle preparation", () => {
  const wordle = definitionFor(sessionCases.find((row) => row.document.type === "mini-wordle")!);
  it("waits for dictionaries without creating or timing a session, and retries load failures", async () => {
    const pending = deferred<Set<string>>();
    vi.mocked(loadMiniWordleDictionary)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Set(["JOSUE"]));
    render(<LocalPyramidGameApp definition={wordle} />);
    expect(screen.getByRole("status").textContent).toContain("Cargando diccionario");
    expect(createLocalPyramidSessionProvider).not.toHaveBeenCalled();
    await act(async () => {
      pending.reject(new Error("offline"));
    });
    expect(screen.getByRole("alert").textContent).toContain("No se pudo cargar");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    });
    expect(loadMiniWordleDictionary).toHaveBeenCalledWith(5);
    expect(session().phase).toBe("intro");
    expect(createLocalPyramidSessionProvider).toHaveBeenCalledWith(
      expect.objectContaining({ dictionaries: new Map([["es-general-5.v1", new Set(["JOSUE"])]]) }),
    );
  });

  it.each(["change", "unmount"])("ignores a dictionary resolved after %s", async (action) => {
    const pending = deferred<Set<string>>();
    vi.mocked(loadMiniWordleDictionary).mockReturnValueOnce(pending.promise);
    const app = render(<LocalPyramidGameApp definition={wordle} />);
    if (action === "change")
      app.rerender(
        <LocalPyramidGameApp
          definition={{
            ...definition,
            challenge: { ...definition.challenge, id: "new-challenge" },
          }}
        />,
      );
    else app.unmount();
    const calls = vi.mocked(createLocalPyramidSessionProvider).mock.calls.length;
    await act(async () => {
      pending.resolve(new Set(["JOSUE"]));
    });
    expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(calls);
    if (action === "change") expect(view().challenge.id).toBe("new-challenge");
  });
});
