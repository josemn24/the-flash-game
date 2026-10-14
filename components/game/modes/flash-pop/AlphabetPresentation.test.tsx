// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timer, TimerDisplay } from "@/components/ui";
import { useState } from "react";
import { AlphabetPlayingPresentation } from "./AlphabetPresentation";

type Props = ComponentProps<typeof AlphabetPlayingPresentation>;
const questionA = { id: "question-a", question: "Animal con placas óseas" };
const questionB = { id: "question-b", question: "País más extenso de Sudamérica" };
const initialLetters: Props["letters"] = [
  { letter: "A", status: "active" },
  { letter: "B", status: "unvisited" },
  { letter: "C", status: "unvisited" },
];
function props(overrides: Partial<Props> = {}): Props {
  return {
    round: 1,
    currentIndex: 0,
    answerVisitKey: "1:0",
    letters: initialLetters,
    question: questionA,
    timer: <TimerDisplay duration={135} remaining={111} />,
    locked: false,
    onSubmit: vi.fn(),
    onPass: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Alphabet playing presentation", () => {
  it("starts empty with a letter placeholder, sends only typed text and clears on the next visit", () => {
    const initial = props({ question: { ...questionA, answerLength: 8 } });
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} question={null} busy />);
    const editor = screen.getByRole("textbox");
    const filled = () => editor.querySelectorAll('[data-answer-slot="filled"]');
    const reference = () => editor.querySelector("[data-answer-placeholder]");
    expect(filled()).toHaveLength(0);
    expect(reference()).toBeNull();
    rerender(<AlphabetPlayingPresentation {...initial} />);
    expect(filled()).toHaveLength(0);
    expect(editor.querySelectorAll('[data-answer-slot="empty"]')).toHaveLength(8);
    expect(reference()?.textContent).toBe("A");
    expect(reference()?.getAttribute("data-answer-slot")).toBe("empty");
    expect(screen.getByText("0 escritos")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "A" });
    expect(filled()).toHaveLength(1);
    expect(filled()[0].textContent).toBe("A");
    expect(reference()).toBeNull();
    fireEvent.keyDown(editor, { key: "A" });
    expect(filled()).toHaveLength(2);
    fireEvent.keyDown(editor, { key: "Backspace" });
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(filled()).toHaveLength(0);
    expect(reference()?.textContent).toBe("A");
    rerender(<AlphabetPlayingPresentation {...initial} question={{ ...initial.question! }} />);
    expect(filled()).toHaveLength(0);
    fireEvent.keyDown(editor, { key: "Z" });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).toHaveBeenCalledExactlyOnceWith("Z");
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        answerVisitKey="1:1"
        question={questionB}
        letters={[
          { letter: "A", status: "passed" },
          { letter: "B", status: "active" },
          { letter: "C", status: "unvisited" },
        ]}
      />,
    );
    expect(filled()).toHaveLength(0);
    expect(reference()?.textContent).toBe("B");
    expect((screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("fills the principal slots, accepts overflow and does not submit automatically", () => {
    const initial = props({ question: { ...questionA, answerLength: 12 } });
    render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    const holes = () => editor.querySelectorAll('[data-answer-slot="empty"]');
    const filled = () => editor.querySelectorAll('[data-answer-slot="filled"]');
    expect(holes()).toHaveLength(12);
    expect(filled()).toHaveLength(0);
    expect(screen.getByText("Respuesta principal: 12 caracteres")).toBeTruthy();
    expect(editor.getAttribute("aria-describedby")).toContain(
      screen.getByText("Respuesta principal: 12 caracteres").parentElement!.id,
    );
    for (const key of "Archipiélago") fireEvent.keyDown(editor, { key });
    expect(holes()).toHaveLength(0);
    expect(filled()).toHaveLength(12);
    expect(editor.querySelectorAll('[data-answer-slot="caret"]')).toHaveLength(1);
    expect(initial.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(editor, { key: "s" });
    expect(filled()).toHaveLength(13);
    expect(screen.getByText("13 escritos")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).toHaveBeenCalledExactlyOnceWith("Archipiélagos");
  });

  it("permits shorter drafts and shares the reference with an unrestricted native input", () => {
    const initial = props({ question: { ...questionA, answerLength: 9 } });
    render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    for (const key of "Auto") fireEvent.keyDown(editor, { key });
    expect(editor.querySelectorAll('[data-answer-slot="empty"]')).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Auto");
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(4);
    expect(input.hasAttribute("maxlength")).toBe(false);
    expect(input.hasAttribute("minlength")).toBe(false);
    expect(screen.getByText("4 escritos")).toBeTruthy();
    fireEvent.change(input, { target: { value: "coche" } });
    fireEvent.submit(input.closest("form")!);
    expect(initial.onSubmit).toHaveBeenCalledExactlyOnceWith("coche");
  });

  it("counts spaces as separators and keeps the draft when a reference arrives", () => {
    const initial = props();
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    for (const key of "Ñ  ") fireEvent.keyDown(editor, { key });
    fireEvent.keyDown(editor, { key: "a\u0301" });
    expect(screen.getByText("2 escritos")).toBeTruthy();
    expect(editor.querySelectorAll('[data-answer-slot="space"]')).toHaveLength(1);
    rerender(
      <AlphabetPlayingPresentation {...initial} question={{ ...questionA, answerLength: 8 }} />,
    );
    expect(editor.textContent).toContain("Ñ  a\u0301");
    expect(editor.querySelectorAll('[data-answer-slot="empty"]')).toHaveLength(6);
    expect(screen.getByText("Respuesta principal: 8 caracteres")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(screen.getByText("1 escrito")).toBeTruthy();
  });

  it("types with touch keys, keeps editor focus and deletes whole Unicode characters", () => {
    render(<AlphabetPlayingPresentation {...props()} />);
    const editor = screen.getByRole("textbox", { name: "Tu respuesta" });
    expect(editor.tagName).toBe("DIV");
    expect(document.querySelector("input")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Borrar último carácter" }));
    const key = screen.getByRole("button", { name: /^Ñ$/ });
    fireEvent.pointerDown(key);
    fireEvent.click(key);
    fireEvent.click(screen.getByRole("button", { name: "Espacio" }));
    expect(document.activeElement).toBe(editor);
    fireEvent.keyDown(editor, { key: "a\u0301" });
    fireEvent.keyDown(editor, { key: "👨‍👩‍👧‍👦" });
    fireEvent.click(screen.getByRole("button", { name: "Borrar último carácter" }));
    expect(editor.textContent).toContain("Ñ a\u0301");
    expect(editor.textContent).not.toContain("👨");
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(editor.textContent).not.toContain("\u0301");
    fireEvent.keyDown(editor, { key: "á" });
    fireEvent.keyDown(editor, { key: "v", ctrlKey: true });
    fireEvent.keyDown(editor, { key: "r", metaKey: true });
    fireEvent.keyDown(editor, { key: "Tab" });
    expect(editor.textContent).toContain("Ñ á");
  });

  it("shares the draft with the native input and retains its mode on confirmed visits", () => {
    const initial = props();
    const { rerender, unmount } = render(<AlphabetPlayingPresentation {...initial} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ñ" });
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado" }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("ñ");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("group", { name: "Teclado del juego" })).toBeNull();
    fireEvent.change(input, { target: { value: "España larga" } });
    // Temporary preparation and ordinary render/timer updates do not erase text.
    rerender(
      <AlphabetPlayingPresentation {...initial} question={null} busy answerVisitKey={null} />,
    );
    expect(input.value).toBe("España larga");
    rerender(
      <AlphabetPlayingPresentation {...initial} question={{ ...questionA }} error="Sin conexión" />,
    );
    expect(input.value).toBe("España larga");
    rerender(
      <AlphabetPlayingPresentation {...initial} answerVisitKey="question-a:next-presented-at" />,
    );
    expect(screen.getByRole("textbox").tagName).toBe("INPUT");
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("A");
    fireEvent.change(input, { target: { value: "Árbol" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del juego" }));
    expect(screen.getByRole("textbox").textContent).toContain("Árbol");
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    unmount();
    render(<AlphabetPlayingPresentation {...initial} />);
    expect(screen.getByRole("textbox").tagName).toBe("DIV");
    expect(
      screen.getByRole("textbox").querySelectorAll('[data-answer-slot="filled"]'),
    ).toHaveLength(0);
    expect(
      screen.getByRole("textbox").querySelector("[data-answer-placeholder]")?.textContent,
    ).toBe("A");
  });

  it("blocks empty, repeated and busy submissions without clearing a rejected draft", () => {
    const initial = props();
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    fireEvent.keyDown(editor, { key: " " });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(editor, { key: "é" });
    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).toHaveBeenCalledExactlyOnceWith(" é");
    rerender(<AlphabetPlayingPresentation {...initial} busy />);
    fireEvent.keyDown(editor, { key: "x" });
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(editor.textContent).toContain(" é");
    rerender(<AlphabetPlayingPresentation {...initial} error="Error de red" />);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).toHaveBeenCalledTimes(2);
    rerender(<AlphabetPlayingPresentation {...initial} locked />);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(initial.onSubmit).toHaveBeenCalledTimes(2);
  });

  it("collapses in a short visual viewport and preserves expansion across repeated visits", () => {
    const viewport = Object.assign(new EventTarget(), { height: 390, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const initial = props();
    const { rerender, unmount } = render(<AlphabetPlayingPresentation {...initial} />);
    expect(screen.queryByRole("group", { name: "Teclado del juego" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar teclado" }));
    expect(screen.getByRole("group", { name: "Teclado del juego" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
    rerender(<AlphabetPlayingPresentation {...initial} round={2} answerVisitKey="2:0" />);
    expect(screen.getByRole("button", { name: "Ocultar teclado" })).toBeTruthy();
    expect(
      screen.getByRole("textbox").querySelectorAll('[data-answer-slot="filled"]'),
    ).toHaveLength(0);
    expect(
      screen.getByRole("textbox").querySelector("[data-answer-placeholder]")?.textContent,
    ).toBe("A");
    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("button", { name: "Ocultar teclado" })).toBeNull();
    act(() => {
      viewport.height = 640;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("group", { name: "Teclado del juego" })).toBeNull();
    unmount();
    Reflect.deleteProperty(window, "visualViewport");
  });

  it("shows every challenge letter inline and marks the current cell through passes and feedback", () => {
    const letters: Props["letters"] = Array.from("ABCDEFGHIJLMOPRSTZ", (letter, index) => ({
      letter,
      status: index === 0 ? "active" : "unvisited",
    }));
    const initial = props({ letters });
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const board = screen.getByRole("list", { name: "Estado de las letras" });
    expect(within(board).getAllByRole("listitem")).toHaveLength(18);
    expect(within(board).getByLabelText("A: Activa").getAttribute("aria-current")).toBe("step");
    expect(screen.queryByRole("list", { name: "Recorrido de letras" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver todas" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      within(screen.getByRole("status")).getByText("0 aciertos · 0 fallos · 18 pendientes"),
    ).toBeTruthy();
    const passed = letters.map((item, index) => ({
      ...item,
      status: index === 0 ? ("passed" as const) : index === 1 ? ("active" as const) : item.status,
    }));
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        answerVisitKey="1:1"
        question={questionB}
        letters={passed}
      />,
    );
    expect(within(board).getByLabelText("A: Pasada").hasAttribute("aria-current")).toBe(false);
    expect(within(board).getByLabelText("B: Activa").getAttribute("aria-current")).toBe("step");
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        answerVisitKey="1:1"
        question={questionB}
        letters={passed.map((item, index) => (index === 1 ? { ...item, status: "correct" } : item))}
        locked
      />,
    );
    expect(within(board).getByLabelText("B: Correcta").getAttribute("aria-current")).toBe("step");
    expect(within(board).getAllByRole("listitem")).toHaveLength(18);
    expect(
      within(screen.getByRole("status")).getByText("1 acierto · 0 fallos · 17 pendientes"),
    ).toBeTruthy();
  });

  it("keeps the board visible while editing is blocked by submission or feedback", () => {
    const initial = props({ busy: true });
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    expect(editor.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("list", { name: "Estado de las letras" })).toBeTruthy();
    rerender(<AlphabetPlayingPresentation {...initial} busy={false} />);
    expect(document.activeElement).toBe(editor);
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        busy={false}
        feedback={{ id: "a", isCorrect: true, eyebrow: "", body: "" }}
      />,
    );
    expect(editor.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("list", { name: "Estado de las letras" })).toBeTruthy();
  });

  it("retains all recovered states and the last pending hint across repeated visits", () => {
    const recovered = props({
      currentIndex: 1,
      question: questionB,
      letters: [
        { letter: "A", status: "correct" },
        { letter: "B", status: "active" },
        { letter: "C", status: "incorrect" },
      ],
    });
    const { rerender } = render(<AlphabetPlayingPresentation {...recovered} />);
    const progress = screen.getByRole("status");
    expect(within(progress).getByText("1 acierto · 1 fallo · 1 pendiente")).toBeTruthy();
    for (const label of ["Aciertos", "Fallos", "Pendientes"]) {
      expect(screen.queryByTitle(label)).toBeNull();
    }
    const board = screen.getByRole("list", { name: "Estado de las letras" });
    expect(within(board).getByLabelText("A: Correcta")).toBeTruthy();
    expect(within(board).getByLabelText("B: Activa")).toBeTruthy();
    expect(within(board).getByLabelText("C: Incorrecta")).toBeTruthy();
    expect(screen.getByText("Última pendiente")).toBeTruthy();
    rerender(<AlphabetPlayingPresentation {...recovered} round={2} question={{ ...questionB }} />);
    expect(within(board).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Última pendiente")).toHaveLength(1);
  });

  it("keeps the global timer ticking with the inline board and expires only once", async () => {
    vi.useFakeTimers();
    const finish = vi.fn();
    function TimedGame() {
      const [completed, setCompleted] = useState(false);
      return completed ? (
        <p>Completado</p>
      ) : (
        <AlphabetPlayingPresentation
          {...props()}
          timer={
            <Timer
              duration={3}
              active
              onTimeUp={() => {
                finish();
                setCompleted(true);
              }}
            />
          }
        />
      );
    }
    render(<TimedGame />);
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("2 segundos restantes");
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("Completado")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
