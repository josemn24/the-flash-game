// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { PyramidGameView } from "../modes/flash-pop/PyramidGameView";
import { createLocalPyramidSessionProvider } from "@/features/game/session/providers/localPyramid";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import { definitionFor, sessionCases } from "@/test-utils/game-session-conformance/corpus";
import { RehearsalGameApp } from "./RehearsalGameApp.client";

const mocks = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("../modes/flash-pop/PyramidGameView", () => ({
  PyramidGameView(props: Parameters<typeof PyramidGameView>[0]) {
    mocks.view(props);
    return <p>{props.session.phase}</p>;
  },
}));
vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
vi.mock("@/features/game/session/providers/localPyramid", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/features/game/session/providers/localPyramid")>();
  return {
    ...original,
    createLocalPyramidSessionProvider: vi.fn(
      (options: Parameters<typeof original.createLocalPyramidSessionProvider>[0]) => {
        const provider = original.createLocalPyramidSessionProvider(options);
        return { ...provider, execute: vi.fn(provider.execute) };
      },
    ),
  };
});
const recipe = {
  sessionId: "test",
  seed: "test",
  generatorVersion: 1 as const,
  bankRevision: "a".repeat(64),
  templateHash: "b".repeat(64),
  challengeVersionId: "source",
  questions: [],
};
const simple = definitionFor(sessionCases[0]!);
const wordle = definitionFor(sessionCases.find((row) => row.document.type === "mini-wordle")!);
const imageDefinition = definitionFor(
  sessionCases.find((row) => row.document.type === "progressive-image")!,
);
const view = () => mocks.view.mock.lastCall![0] as Parameters<typeof PyramidGameView>[0];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps one authority on rerender and replaces it when the artifact version changes", async () => {
  const app = render(<RehearsalGameApp definition={simple} recipe={recipe} returnTo="/desafio" />);
  await act(async () => {});
  expect(view().returnTo).toBe("/desafio");
  expect(view().session.phase).toBe("briefing");
  expect(screen.queryByRole("button", { name: "Empezar prueba" })).toBeNull();
  const attemptId = view().session.attempt!.id;
  app.rerender(
    <RehearsalGameApp
      definition={structuredClone(simple)}
      recipe={{ ...recipe }}
      returnTo="/desafio"
    />,
  );
  expect(view().session.attempt!.id).toBe(attemptId);
  expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(1);
  app.rerender(
    <RehearsalGameApp
      definition={simple}
      recipe={{ ...recipe, sessionId: "another-session" }}
      returnTo="/desafio"
    />,
  );
  await act(async () => {});
  expect(view().session.phase).toBe("briefing");
  expect(view().session.attempt!.id).not.toBe(attemptId);
  expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(2);
});

it("starts once when StrictMode replays mounting effects", async () => {
  render(
    <StrictMode>
      <RehearsalGameApp definition={simple} recipe={recipe} returnTo="/desafio" />
    </StrictMode>,
  );
  await act(async () => {});
  expect(view().session.phase).toBe("briefing");
  const commands = vi
    .mocked(createLocalPyramidSessionProvider)
    .mock.results.flatMap(({ value }) => {
      const provider: ReturnType<typeof createLocalPyramidSessionProvider> = value;
      return vi.mocked(provider.execute).mock.calls.map(([command]) => command);
    });
  expect(commands.filter((command) => command.operation === "start")).toHaveLength(1);
});

it("does not create a session while a dictionary is pending, and retries failed preparation", async () => {
  const pending = deferred<Set<string>>();
  vi.mocked(loadMiniWordleDictionary)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(new Set(["JOSUE"]));
  render(<RehearsalGameApp definition={wordle} recipe={recipe} returnTo="/desafio" />);
  expect(screen.getByRole("status").textContent).toContain("Preparando");
  expect(createLocalPyramidSessionProvider).not.toHaveBeenCalled();
  await act(async () => {
    pending.reject(new Error("offline"));
  });
  expect(screen.getByRole("alert").textContent).toContain("recursos");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  });
  expect(view().session.phase).toBe("briefing");
  expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(1);
});

it.each(["change", "unmount"])("ignores late preparation after %s", async (action) => {
  const pending = deferred<Set<string>>();
  vi.mocked(loadMiniWordleDictionary).mockReturnValueOnce(pending.promise);
  const app = render(<RehearsalGameApp definition={wordle} recipe={recipe} returnTo="/desafio" />);
  if (action === "change") {
    app.rerender(
      <RehearsalGameApp
        definition={simple}
        recipe={{ ...recipe, sessionId: "another-session" }}
        returnTo="/desafio"
      />,
    );
    await act(async () => {});
  } else app.unmount();
  const calls = vi.mocked(createLocalPyramidSessionProvider).mock.calls.length;
  await act(async () => {
    pending.resolve(new Set(["JOSUE"]));
  });
  expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(calls);
});

it("waits for images and allows retry without starting a clock", async () => {
  const images: { onload: null | (() => void); onerror: null | (() => void); src: string }[] = [];
  vi.stubGlobal(
    "Image",
    class {
      onload = null;
      onerror = null;
      src = "";
      constructor() {
        images.push(this);
      }
    },
  );
  render(<RehearsalGameApp definition={imageDefinition} recipe={recipe} returnTo="/desafio" />);
  expect(images.length).toBeGreaterThan(0);
  expect(createLocalPyramidSessionProvider).not.toHaveBeenCalled();
  await act(async () => {
    images[0]!.onerror!();
  });
  expect(screen.getByRole("alert")).toBeDefined();
  const previous = images.length;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  });
  await act(async () => {
    images.slice(previous).forEach((image) => image.onload!());
  });
  expect(view().session.phase).toBe("briefing");
  expect(createLocalPyramidSessionProvider).toHaveBeenCalledTimes(1);
});
