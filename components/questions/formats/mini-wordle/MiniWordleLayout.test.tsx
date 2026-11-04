// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionStage } from "@/components/game/shared/QuestionStage";
import { SessionQuestionStage } from "@/components/game/shared/SessionQuestionStage";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import { practiceInputFor } from "@/test-utils/practiceInput";
import { competitiveInputFor } from "@/test-utils/competitiveInput";
import { publicMiniWordle } from "@/test-utils/competitiveGameplay";

vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
beforeEach(() => {
  vi.mocked(loadMiniWordleDictionary).mockResolvedValue(new Set(["CASA"]));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "visualViewport");
});

function renderStage(mode: "practice" | "competitive", action = vi.fn()) {
  const common = { questionNumber: 1, totalQuestions: 2, onTimeUp: vi.fn() };
  return mode === "practice"
    ? render(
        <QuestionStage
          {...common}
          input={practiceInputFor("mini-wordle", { onProgress: action })}
          renderHeader={() => <h2>Cabecera</h2>}
        />,
      )
    : render(
        <SessionQuestionStage
          {...common}
          input={competitiveInputFor("mini-wordle", {
            question: publicMiniWordle,
            submitMiniWordleGuess: action,
          })}
        />,
      );
}

describe.each(["practice", "competitive"] as const)("%s Wordle keyboard layout", (mode) => {
  it("keeps controls outside the scrolling question and submits the original form once", async () => {
    const action = vi.fn();
    renderStage(mode, action);
    const editor = screen.getByRole("textbox", { name: "Escribe tu intento" });
    await waitFor(() => expect(editor.getAttribute("aria-disabled")).toBe("false"));
    const form = editor.closest("form");
    const send = screen.getByRole<HTMLButtonElement>("button", { name: "Enviar" });
    const dock = document.querySelector("[data-keyboard-dock]")!;
    const scroll = document.querySelector("[data-keyboard-scroll]")!;
    expect(scroll.contains(editor)).toBe(true);
    expect(scroll.contains(send)).toBe(false);
    expect(dock.contains(screen.getByRole("group", { name: "Teclado del juego" }))).toBe(true);
    expect(dock.contains(send)).toBe(true);
    expect(form?.contains(send)).toBe(false);
    expect(send.form).toBe(form);
    for (const letter of mode === "practice" ? "CASA" : "JOSUE") {
      fireEvent.click(screen.getByRole("button", { name: letter }));
    }
    fireEvent.click(send);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(mode === "practice" ? { guesses: ["CASA"] } : "JOSUE");
    expect(document.activeElement).toBe(editor);
  });
});

it("tracks the visual viewport without remounting the editor or its draft", async () => {
  const viewport = Object.assign(new EventTarget(), { height: 700, offsetTop: 0 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  renderStage("competitive");
  const editor = screen.getByRole("textbox", { name: "Escribe tu intento" });
  fireEvent.keyDown(editor, { key: "J" });
  const frame = document.querySelector<HTMLElement>("[data-keyboard-layout]")!;
  act(() => {
    viewport.height = 280;
    viewport.offsetTop = 48;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(frame.style.getPropertyValue("--keyboard-viewport-height")).toBe("280px");
  expect(frame.style.getPropertyValue("--keyboard-viewport-top")).toBe("48px");
  expect(frame.hasAttribute("data-compact-keyboard")).toBe(true);
  expect(screen.getByRole("textbox", { name: "Escribe tu intento" })).toBe(editor);
  expect(editor.textContent).toBe("J");
});
