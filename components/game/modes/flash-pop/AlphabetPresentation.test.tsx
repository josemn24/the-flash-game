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
const media = new EventTarget();
let mobile = true;
function props(overrides: Partial<Props> = {}): Props {
  return {
    round: 1,
    currentIndex: 0,
    answerVisitKey: "1:0",
    letters: initialLetters,
    question: questionA,
    timer: <TimerDisplay duration={135} remaining={111} />,
    dialogTimer: <TimerDisplay duration={135} remaining={111} />,
    locked: false,
    onSubmit: vi.fn(),
    onPass: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mobile = true;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      get matches() {
        return mobile;
      },
      addEventListener: media.addEventListener.bind(media),
      removeEventListener: media.removeEventListener.bind(media),
    })),
  });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        if (!this.open) return;
        this.open = false;
        this.dispatchEvent(new Event("close"));
      },
    },
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Alphabet playing presentation", () => {
  it("seeds an editable initial once per visit and leaves repeated letters unchanged", () => {
    const initial = props({ question: { ...questionA, answerLength: 8 } });
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} question={null} busy />);
    expect(
      screen.getByRole("textbox").querySelectorAll('[data-answer-slot="filled"]'),
    ).toHaveLength(0);
    rerender(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    expect(editor.querySelector('[data-answer-slot="filled"]')?.textContent).toBe("A");
    fireEvent.keyDown(editor, { key: "A" });
    expect(editor.querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(2);
    expect(within(editor).getByText("AA")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "Backspace" });
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(editor.querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(0);
    rerender(<AlphabetPlayingPresentation {...initial} question={{ ...initial.question! }} />);
    expect(editor.querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(0);
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
    expect(editor.querySelectorAll('[data-answer-slot="filled"]')).toHaveLength(1);
    expect(editor.querySelector('[data-answer-slot="filled"]')?.textContent).toBe("B");
  });

  it("fills the principal slots, accepts overflow and does not submit automatically", () => {
    const initial = props({ question: { ...questionA, answerLength: 12 } });
    render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    const holes = () => editor.querySelectorAll('[data-answer-slot="empty"]');
    const filled = () => editor.querySelectorAll('[data-answer-slot="filled"]');
    expect(holes()).toHaveLength(11);
    expect(filled()).toHaveLength(1);
    expect(filled()[0].textContent).toBe("A");
    expect(screen.getByText("Respuesta principal: 12 caracteres")).toBeTruthy();
    expect(editor.getAttribute("aria-describedby")).toContain(
      screen.getByText("Respuesta principal: 12 caracteres").parentElement!.id,
    );
    for (const key of "rchipiélago") fireEvent.keyDown(editor, { key });
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
    for (const key of "uto") fireEvent.keyDown(editor, { key });
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
    fireEvent.keyDown(editor, { key: "Backspace" });
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
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Backspace" });
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
    expect(input.value).toBe("A");
    fireEvent.change(input, { target: { value: "Árbol" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del juego" }));
    expect(screen.getByRole("textbox").textContent).toContain("Árbol");
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    unmount();
    render(<AlphabetPlayingPresentation {...initial} />);
    expect(screen.getByRole("textbox").tagName).toBe("DIV");
    expect(
      screen.getByRole("textbox").querySelector('[data-answer-slot="filled"]')?.textContent,
    ).toBe("A");
  });

  it("blocks empty, repeated and busy submissions without clearing a rejected draft", () => {
    const initial = props();
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const editor = screen.getByRole("textbox");
    fireEvent.keyDown(editor, { key: "Backspace" });
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

  it("suspends editor keys in the board dialog and restores both kinds of editor", () => {
    render(<AlphabetPlayingPresentation {...props()} />);
    for (const mode of ["game", "device"]) {
      if (mode === "device") fireEvent.click(screen.getByRole("button", { name: "Usar teclado" }));
      const editor = screen.getByRole("textbox");
      editor.focus();
      const opener = screen.getByRole("button", { name: "Ver todas" });
      fireEvent.pointerDown(opener);
      fireEvent.click(opener, { detail: 1 });
      fireEvent.keyDown(editor, { key: "z" });
      fireEvent.click(screen.getByRole("button", { name: "Cerrar tablero" }));
      expect(document.activeElement).toBe(editor);
      expect(editor.textContent).not.toContain("z");
    }
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
    ).toHaveLength(1);
    expect(
      screen.getByRole("textbox").querySelector('[data-answer-slot="filled"]')?.textContent,
    ).toBe("A");
    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("button", { name: "Ocultar teclado" })).toBeNull();
    act(() => {
      viewport.height = 480;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("group", { name: "Teclado del juego" })).toBeNull();
    unmount();
    Reflect.deleteProperty(window, "visualViewport");
  });

  it("shows explicit progress and keeps three positions through passes, answers and recovery", () => {
    const initial = props();
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    const navigation = screen.getByRole("list", { name: "Recorrido de letras" });
    expect(within(navigation).getAllByRole("listitem")).toHaveLength(3);
    expect(within(navigation).getByLabelText("Anterior: no disponible")).toBeTruthy();
    expect(
      within(screen.getByRole("status")).getByText("0 aciertos · 0 fallos · 3 pendientes"),
    ).toBeTruthy();
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        question={questionB}
        letters={[
          { letter: "A", status: "passed" },
          { letter: "B", status: "active" },
          { letter: "C", status: "unvisited" },
        ]}
      />,
    );
    expect(within(navigation).getByLabelText("Anterior: A: Pasada")).toBeTruthy();
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        question={questionB}
        letters={[
          { letter: "A", status: "passed" },
          { letter: "B", status: "correct" },
          { letter: "C", status: "unvisited" },
        ]}
        locked
      />,
    );
    expect(within(navigation).getByLabelText("Actual: B: Correcta")).toBeTruthy();
    expect(
      within(screen.getByRole("status")).getByText("1 acierto · 0 fallos · 2 pendientes"),
    ).toBeTruthy();
  });

  it("preserves the draft, scroll and editing focus when closing the board", () => {
    render(<AlphabetPlayingPresentation {...props()} />);
    const input = screen.getByRole("textbox", { name: "Tu respuesta" }) as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    for (const key of "arma") fireEvent.keyDown(input, { key });
    input.focus();
    const opener = screen.getByRole("button", { name: "Ver todas" });
    fireEvent.pointerDown(opener);
    fireEvent.click(opener, { detail: 1 });
    const dialog = screen.getByRole("dialog", { name: "Estado de las letras" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(within(dialog).getByRole("timer").getAttribute("aria-label")).toBe(
      "111 segundos restantes",
    );
    expect(within(dialog).getByText("0 aciertos · 0 fallos · 3 pendientes")).toBeTruthy();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Cerrar tablero" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar tablero" }));
    expect(input.textContent).toContain("arma");
    expect(document.activeElement).toBe(input);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("returns keyboard focus to the opener and supports Escape and backdrop dismissal", () => {
    render(<AlphabetPlayingPresentation {...props()} />);
    const opener = screen.getByRole("button", { name: "Ver todas" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps focus inside the dialog if the server prepares a new question", () => {
    const initial = props();
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    const closer = screen.getByRole("button", { name: "Cerrar tablero" });
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        currentIndex={1}
        question={questionB}
        letters={[
          { letter: "A", status: "passed" },
          { letter: "B", status: "active" },
          { letter: "C", status: "unvisited" },
        ]}
      />,
    );
    expect(document.activeElement).toBe(closer);
    fireEvent.click(closer);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver todas" }));
  });

  it("blocks opening during submission and feedback and focuses only once editable", () => {
    const initial = props({ busy: true });
    const { rerender } = render(<AlphabetPlayingPresentation {...initial} />);
    expect((screen.getByRole("button", { name: "Ver todas" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    rerender(<AlphabetPlayingPresentation {...initial} busy={false} />);
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    rerender(
      <AlphabetPlayingPresentation
        {...initial}
        busy={false}
        feedback={{ id: "a", isCorrect: true, eyebrow: "", body: "" }}
      />,
    );
    expect((screen.getByRole("button", { name: "Ver todas" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("closes when switching to desktop and when the playing screen unmounts", () => {
    const { unmount } = render(<AlphabetPlayingPresentation {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    act(() => {
      mobile = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      mobile = true;
      media.dispatchEvent(new Event("change"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    unmount();
    expect(dialog.open).toBe(false);
  });

  it("does not invent history on recovery or duplicate a repeatedly passed last letter", () => {
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
      const counter = within(progress).getByTitle(label);
      expect(counter.textContent).toBe("1");
      expect(counter.getAttribute("aria-hidden")).toBe("true");
    }
    const navigation = screen.getByRole("list", { name: "Recorrido de letras" });
    expect(within(navigation).getByLabelText("Anterior: no disponible")).toBeTruthy();
    expect(within(navigation).getByLabelText("Siguiente: no disponible")).toBeTruthy();
    expect(screen.getByText("Última pendiente")).toBeTruthy();
    rerender(<AlphabetPlayingPresentation {...recovered} round={2} question={{ ...questionB }} />);
    expect(within(navigation).getByLabelText("Anterior: no disponible")).toBeTruthy();
  });

  it("displays the original timer ticks in the dialog and expires only once", async () => {
    vi.useFakeTimers();
    const finish = vi.fn();
    function TimedGame() {
      const [remaining, setRemaining] = useState(3);
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
              onTick={(value) => setRemaining(Math.ceil(value))}
              onTimeUp={() => {
                finish();
                setCompleted(true);
              }}
            />
          }
          dialogTimer={<TimerDisplay duration={3} remaining={remaining} />}
        />
      );
    }
    render(<TimedGame />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(within(screen.getByRole("dialog")).getByRole("timer").getAttribute("aria-label")).toBe(
      "2 segundos restantes",
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("Completado")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
