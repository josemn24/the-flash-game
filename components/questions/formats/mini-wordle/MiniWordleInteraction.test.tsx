// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import { questionsById } from "@/test-utils/mockGameplay";
import { publicMiniWordle } from "@/test-utils/competitiveGameplay";
import { render as MiniWordleInput } from "@/features/question-formats/formats/mini-wordle/input";
import { PracticeInput } from "@/features/question-formats/formats/mini-wordle/PracticeInput";
import { MiniWordleQuestion } from "./MiniWordleQuestion";
import { ServerMiniWordleQuestion } from "./ServerMiniWordleQuestion";

vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
const dictionary = vi.mocked(loadMiniWordleDictionary);
const words = new Set(["JOSUE", "SALON", "CAÑON", "LUNA", "CASA"]);
const callbacks = () => ({ onProgress: vi.fn(), onSubmit: vi.fn(), onTimedResponseStart: vi.fn() });
const practice = { correctAnswer: "Jesús", wordLength: 5 as const, maxAttempts: 4, locked: false };
const editor = () => screen.getByRole("textbox", { name: "Escribe tu intento" });
const blocked = () => editor().getAttribute("aria-disabled") === "true";
const draft = () =>
  editor() instanceof HTMLInputElement
    ? (editor() as HTMLInputElement).value
    : editor().textContent?.replace("Intento vacío", "");
const send = () => screen.getByRole<HTMLButtonElement>("button", { name: "Enviar" });
function write(value: string) {
  if (editor() instanceof HTMLInputElement) {
    fireEvent.change(editor(), { target: { value } });
  } else {
    for (let i = draft()?.length ?? 0; i > 0; i--)
      fireEvent.keyDown(editor(), { key: "Backspace" });
    for (const key of value) fireEvent.keyDown(editor(), { key });
  }
}
function guess(value: string) {
  write(value);
  fireEvent.keyDown(editor(), { key: "Enter" });
}
async function ready() {
  await waitFor(() => expect(blocked()).toBe(false));
}
beforeEach(() => {
  vi.clearAllMocks();
  dictionary.mockResolvedValue(words);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("practice Mini-Wordle interactions", () => {
  it("loads before enabling editing and starts the timer only once in StrictMode", async () => {
    let resolve!: (value: Set<string>) => void;
    dictionary.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const actions = callbacks();
    const view = render(
      <StrictMode>
        <MiniWordleQuestion {...practice} {...actions} />
      </StrictMode>,
    );
    expect(blocked()).toBe(true);
    expect(screen.getByText("Cargando diccionario…")).toBeTruthy();
    expect(actions.onTimedResponseStart).not.toHaveBeenCalled();
    await act(async () => resolve(words));
    expect(blocked()).toBe(false);
    expect(document.activeElement).toBe(editor());
    expect(actions.onTimedResponseStart).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <MiniWordleQuestion
          {...practice}
          {...actions}
          onTimedResponseStart={() => actions.onTimedResponseStart()}
        />
      </StrictMode>,
    );
    expect(actions.onTimedResponseStart).toHaveBeenCalledTimes(1);
  });

  it("keeps the timer stopped on dictionary failure and recovers through retry", async () => {
    dictionary.mockRejectedValueOnce(new Error("offline"));
    const actions = callbacks();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await screen.findByText("No se pudo cargar el diccionario.");
    expect(blocked()).toBe(true);
    expect(actions.onTimedResponseStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await ready();
    expect(actions.onTimedResponseStart).toHaveBeenCalledTimes(1);
    expect(dictionary).toHaveBeenCalledTimes(2);
  });

  it("shows letters only in the active row and sends only complete guesses", async () => {
    const actions = callbacks();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await ready();
    write("AB");
    expect(within(screen.getByLabelText("Intento 1, en curso")).getByText("A")).toBeTruthy();
    expect(screen.getByLabelText("Intento 2, vacío").textContent).toBe("");
    expect(send().disabled).toBe(true);
    fireEvent.keyDown(editor(), { key: "Enter" });
    expect(actions.onProgress).not.toHaveBeenCalled();
    write("ZZZZZ");
    expect(send().disabled).toBe(false);
    fireEvent.click(send());
    expect(screen.getByText("Esa palabra no está en la lista de intentos válidos.")).toBeTruthy();
    expect(draft()).toBe("ZZZZZ");
    expect(screen.getByText("Intento 1 de 4")).toBeTruthy();
    write("JOSUE");
    expect(screen.queryByText("Esa palabra no está en la lista de intentos válidos.")).toBeNull();
  });

  it("normalizes all entry methods, limits length and supports the shared touch keyboard", async () => {
    render(<MiniWordleQuestion {...practice} {...callbacks()} />);
    await ready();
    const keyboard = within(screen.getByRole("group", { name: "Teclado del juego" }));
    expect(keyboard.queryByRole("button", { name: "Espacio" })).toBeNull();
    for (const key of "CAÑON") fireEvent.click(keyboard.getByRole("button", { name: key }));
    expect(draft()).toBe("CAÑON");
    fireEvent.click(keyboard.getByRole("button", { name: "A" }));
    expect(draft()).toBe("CAÑON");
    fireEvent.click(keyboard.getByRole("button", { name: "Borrar último carácter" }));
    expect(draft()).toBe("CAÑO");
    write("cañón7 ");
    expect(draft()).toBe("CAÑON");
    fireEvent.keyDown(editor(), { key: "a", ctrlKey: true });
    fireEvent.keyDown(editor(), { key: "z", isComposing: true });
    expect(draft()).toBe("CAÑON");
  });

  it("preserves the editor and focus on accepted guesses and completes on the solution", async () => {
    const actions = callbacks();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await ready();
    const originalEditor = editor();
    guess("cañón");
    expect(actions.onProgress).toHaveBeenLastCalledWith({ guesses: ["CAÑON"] });
    expect(actions.onSubmit).not.toHaveBeenCalled();
    expect(draft()).toBe("");
    expect(editor()).toBe(originalEditor);
    expect(document.activeElement).toBe(editor());
    guess("jesús");
    expect(actions.onSubmit).toHaveBeenCalledExactlyOnceWith({ guesses: ["CAÑON", "JESUS"] });
    expect(screen.getByLabelText("Intento 2: JESUS")).toBeTruthy();
    expect(blocked()).toBe(true);
  });

  it("does not send repeated Enter events or steal focus from another control", async () => {
    const actions = callbacks();
    render(
      <>
        <button>Salir</button>
        <MiniWordleQuestion {...practice} {...actions} />
      </>,
    );
    await ready();
    write("CAÑON");
    fireEvent.keyDown(editor(), { key: "Enter", repeat: true });
    expect(actions.onProgress).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Salir" }).focus();
    fireEvent.submit(editor().closest("form")!);
    expect(actions.onProgress).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Salir" }));
  });

  it("returns typing to the editor when Send is activated from keyboard navigation", async () => {
    render(<MiniWordleQuestion {...practice} {...callbacks()} />);
    await ready();
    write("CAÑON");
    send().focus();
    fireEvent.click(send());
    expect(document.activeElement).toBe(editor());
    fireEvent.keyDown(editor(), { key: "S" });
    expect(draft()).toBe("S");
  });

  it("restores accepted progress and finishes on the last attempt", async () => {
    const actions = callbacks();
    render(
      <MiniWordleQuestion
        {...practice}
        {...actions}
        maxAttempts={2}
        initialAnswer={{ guesses: ["salón"] }}
      />,
    );
    expect(screen.getByLabelText("Intento 1: SALON")).toBeTruthy();
    await ready();
    guess("josué");
    expect(actions.onSubmit).toHaveBeenCalledExactlyOnceWith({ guesses: ["SALON", "JOSUE"] });
    expect(blocked()).toBe(true);
    expect(screen.getByText("Intento 2 de 2")).toBeTruthy();
  });

  it("locks without submitting or accepting edits when time expires", async () => {
    const actions = callbacks();
    const view = render(<MiniWordleQuestion correctAnswer="LUNA" locked={false} {...actions} />);
    await ready();
    write("casa");
    view.rerender(<MiniWordleQuestion correctAnswer="LUNA" locked {...actions} />);
    guess("luna");
    expect(draft()).toBe("CASA");
    expect(blocked()).toBe(true);
    expect(actions.onProgress).not.toHaveBeenCalled();
  });

  it("ignores dictionary completion after unmount", async () => {
    let resolve!: (value: Set<string>) => void;
    dictionary.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const actions = callbacks();
    const view = render(<MiniWordleQuestion {...practice} {...actions} />);
    view.unmount();
    await act(async () => resolve(words));
    expect(actions.onTimedResponseStart).not.toHaveBeenCalled();
  });
});

describe("native Wordle keyboard", () => {
  it("switches with focus in the same row and retains the mode only while mounted", async () => {
    const actions = callbacks();
    const view = render(<MiniWordleQuestion {...practice} {...actions} />);
    await ready();
    write("cañ");
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
    const native = editor() as HTMLInputElement;
    expect(native.tagName).toBe("INPUT");
    expect(native.value).toBe("CAÑ");
    expect(document.activeElement).toBe(native);
    expect(screen.queryByRole("group", { name: "Teclado del juego" })).toBeNull();
    fireEvent.change(native, { target: { value: "cañón 12345" } });
    expect(native.value).toBe("CAÑON");
    expect(screen.getByLabelText("Intento 1, en curso").textContent).toBe("CAÑON");
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del juego" }));
    expect(draft()).toBe("CAÑON");
    expect(document.activeElement).toBe(editor());
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
    view.unmount();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await ready();
    expect(editor().tagName).toBe("DIV");
    expect(draft()).toBe("");
  });

  it("waits for composition completion before normalizing or sending", async () => {
    render(<MiniWordleQuestion {...practice} {...callbacks()} />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
    fireEvent.compositionStart(editor());
    fireEvent.change(editor(), { target: { value: "can\u0303o\u0301n" } });
    fireEvent.keyDown(editor(), { key: "Enter", isComposing: true });
    expect(screen.queryByLabelText("Intento 1: CAÑON")).toBeNull();
    fireEvent.compositionEnd(editor(), { data: "ñ" });
    expect(draft()).toBe("CAÑON");
    fireEvent.keyDown(editor(), { key: "Enter" });
    expect(screen.getByLabelText("Intento 1: CAÑON")).toBeTruthy();
  });
});

describe("competitive Mini-Wordle interactions", () => {
  const base = {
    question: publicMiniWordle,
    progress: publicMiniWordle.progress,
    locked: false,
    submissionState: "idle" as const,
    submissionStatusVisible: false,
  };
  const progress = {
    ...base.progress,
    attemptsUsed: 1,
    guesses: ["JOSUE"],
    feedback: [[{ letter: "J", status: "present" as const }]],
  };

  it("keeps the pending guess, blocks duplicate sends and clears only on server acceptance", () => {
    const onSubmit = vi.fn();
    const view = render(<ServerMiniWordleQuestion {...base} onSubmit={onSubmit} />);
    const originalEditor = editor();
    guess("josué");
    fireEvent.submit(editor().closest("form")!);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("JOSUE");
    expect(draft()).toBe("JOSUE");
    expect(blocked()).toBe(true);
    expect(screen.queryByLabelText("Intento 1: JOSUE")).toBeNull();
    view.rerender(
      <ServerMiniWordleQuestion
        {...base}
        locked
        submissionState="submitting"
        onSubmit={onSubmit}
      />,
    );
    write("SALON");
    expect(draft()).toBe("JOSUE");
    view.rerender(
      <ServerMiniWordleQuestion {...base} progress={progress} locked onSubmit={onSubmit} />,
    );
    expect(draft()).toBe("");
    expect(blocked()).toBe(true);
    view.rerender(<ServerMiniWordleQuestion {...base} progress={progress} onSubmit={onSubmit} />);
    expect(blocked()).toBe(false);
    expect(editor()).toBe(originalEditor);
    expect(document.activeElement).toBe(editor());
    expect(screen.getByLabelText("J: está en otra posición")).toBeTruthy();
    expect(screen.getByText("Intento 2 de 4")).toBeTruthy();
    expect(dictionary).not.toHaveBeenCalled();
  });

  it("keeps native input mounted and focused during checks, rejection and retries", () => {
    const onSubmit = vi.fn();
    const onRetry = vi.fn();
    const view = render(<ServerMiniWordleQuestion {...base} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
    const native = editor() as HTMLInputElement;
    guess("SALON");
    view.rerender(
      <ServerMiniWordleQuestion
        {...base}
        locked
        submissionState="submitting"
        onSubmit={onSubmit}
      />,
    );
    expect(editor()).toBe(native);
    expect(native.disabled).toBe(false);
    expect(document.activeElement).toBe(native);
    fireEvent.change(native, { target: { value: "OTROS" } });
    expect(native.value).toBe("SALON");
    view.rerender(
      <ServerMiniWordleQuestion
        {...base}
        locked
        submissionState="error"
        submissionError="No confirmado"
        onRetry={onRetry}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(draft()).toBe("SALON");
    expect(blocked()).toBe(true);
    view.rerender(
      <ServerMiniWordleQuestion
        {...base}
        submissionError="Palabra rechazada"
        onSubmit={onSubmit}
      />,
    );
    expect(blocked()).toBe(false);
    expect(screen.getByText("Palabra rechazada")).toBeTruthy();
    expect(draft()).toBe("SALON");
    write("JOSUE");
    expect(screen.queryByText("Palabra rechazada")).toBeNull();
    fireEvent.keyDown(native, { key: "Enter" });
    expect(onSubmit).toHaveBeenLastCalledWith("JOSUE");
  });

  it("does not recover focus after the player moves to navigation", () => {
    const onSubmit = vi.fn();
    const view = render(
      <>
        <button>Salir</button>
        <ServerMiniWordleQuestion {...base} onSubmit={onSubmit} />
      </>,
    );
    guess("JOSUE");
    screen.getByRole("button", { name: "Salir" }).focus();
    view.rerender(
      <>
        <button>Salir</button>
        <ServerMiniWordleQuestion {...base} progress={progress} onSubmit={onSubmit} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Salir" }));
  });

  it("resets the draft and keyboard on consecutive questions", () => {
    const onMiniWordleGuess = vi.fn();
    const props = {
      question: publicMiniWordle,
      locked: false,
      submissionState: "idle" as const,
      submissionStatusVisible: false,
      onMiniWordleGuess,
    };
    const view = render(<MiniWordleInput {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
    guess("JOSUE");
    view.rerender(
      <MiniWordleInput {...props} question={{ ...publicMiniWordle, id: "next-wordle" }} />,
    );
    expect(draft()).toBe("");
    expect(editor().tagName).toBe("DIV");
    expect(blocked()).toBe(false);
    guess("SALON");
    expect(onMiniWordleGuess).toHaveBeenLastCalledWith("SALON");
  });

  it("disables the exhausted board", () => {
    const onMiniWordleGuess = vi.fn();
    render(
      <MiniWordleInput
        question={{
          ...publicMiniWordle,
          progress: { ...publicMiniWordle.progress, attemptsUsed: 4 },
        }}
        locked={false}
        submissionState="idle"
        submissionStatusVisible={false}
        onMiniWordleGuess={onMiniWordleGuess}
      />,
    );
    expect(blocked()).toBe(true);
    expect(screen.getByText("Intento 4 de 4")).toBeTruthy();
    expect(dictionary).not.toHaveBeenCalled();
  });

  it("stops editing when authoritative feedback solves the word", () => {
    const onSubmit = vi.fn();
    render(
      <ServerMiniWordleQuestion
        {...base}
        progress={{
          ...progress,
          feedback: [Array.from("JOSUE", (letter) => ({ letter, status: "correct" as const }))],
        }}
        onSubmit={onSubmit}
      />,
    );
    expect(blocked()).toBe(true);
    guess("SALON");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

it("resets the draft and keyboard on consecutive practice questions", async () => {
  const actions = callbacks();
  const question = {
    ...questionsById["abrahamic-mini-wordle-josue"],
    id: "wordle-one",
    wordLength: 4 as const,
    type: "mini-wordle" as const,
    question: "Palabra",
    correctAnswer: "LUNA",
    timeLimit: 40,
    points: 100,
  };
  const props = { question, locked: false, ...actions };
  const view = render(<PracticeInput {...props} />);
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Usar teclado del dispositivo" }));
  write("CAS");
  view.rerender(<PracticeInput {...props} question={{ ...question, id: "wordle-two" }} />);
  await ready();
  expect(draft()).toBe("");
  expect(editor().tagName).toBe("DIV");
});
