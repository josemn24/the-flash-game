// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getChallengeById } from "@/test-utils/mockGameplay";
import { FlashPopAlphabetGame } from "./FlashPopAlphabetGame.client";

// Exercise the real practice shell and reducer without waiting for exit animations.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("starts repeated practice visits empty, retains native mode and resets on a new game", async () => {
  const original = getChallengeById("tabarnia-challenge-02");
  if (original?.mode !== "alphabet") throw new Error("Expected Alphabet challenge");
  const challenge = { ...original, entries: original.entries.slice(0, 1) };
  const { unmount } = render(<FlashPopAlphabetGame challenge={challenge} />);
  fireEvent.click(screen.getByRole("button", { name: "Empezar desafío" }));
  for (let step = 0; step < 4; step++) await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByRole("textbox").tagName).toBe("DIV");
  expect(screen.getByRole("textbox").querySelectorAll('[data-answer-slot="empty"]')).toHaveLength(
    9,
  );
  expect(screen.getByRole("textbox").querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(
    0,
  );
  expect(screen.getByRole("textbox").querySelector("[data-answer-placeholder]")?.textContent).toBe(
    "A",
  );
  fireEvent.click(screen.getByRole("button", { name: "Usar teclado" }));
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "borrador" } });
  fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
  expect(screen.getByRole("textbox").tagName).toBe("INPUT");
  expect(input.value).toBe("");
  expect(screen.getAllByText("Vuelta 2").length).toBeGreaterThan(0);
  fireEvent.change(input, { target: { value: "armadillo" } });
  fireEvent.submit(input.closest("form")!);
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(screen.getByRole("heading", { name: "Alfabeto dominado" })).toBeTruthy();
  unmount();
  render(<FlashPopAlphabetGame challenge={challenge} />);
  fireEvent.click(screen.getByRole("button", { name: "Empezar desafío" }));
  for (let step = 0; step < 4; step++) await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByRole("textbox").tagName).toBe("DIV");
  expect(screen.getByRole("textbox").querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(
    0,
  );
  expect(screen.getByRole("textbox").querySelector("[data-answer-placeholder]")?.textContent).toBe(
    "A",
  );
});
