// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import { publicMiniWordle } from "@/test-utils/competitiveGameplay";
import { render as MiniWordleInput } from "@/features/question-formats/formats/mini-wordle/input";
import { MiniWordleQuestion } from "./MiniWordleQuestion";
import { ServerMiniWordleQuestion } from "./ServerMiniWordleQuestion";

vi.mock("@/lib/miniWordleDictionary", () => ({ loadMiniWordleDictionary: vi.fn() }));
const dictionary = vi.mocked(loadMiniWordleDictionary);
const words = new Set(["JOSUE", "SALON", "CAÑON", "LUNA", "CASA"]);
const callbacks = () => ({ onProgress: vi.fn(), onSubmit: vi.fn(), onTimedResponseStart: vi.fn() });
const practice = { correctAnswer: "Jesús", wordLength: 5 as const, maxAttempts: 4, locked: false };
const input = () => screen.getByLabelText<HTMLInputElement>("Escribe tu intento");
function guess(value: string) {
  fireEvent.change(input(), { target: { value } });
  fireEvent.submit(input().closest("form")!);
}
beforeEach(() => {
  vi.clearAllMocks();
  dictionary.mockResolvedValue(words);
});
afterEach(cleanup);

describe("practice Mini-Wordle interactions", () => {
  it("loads before enabling input and starts the timer only once, including StrictMode", async () => {
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
    expect(input().disabled).toBe(true);
    expect(screen.getByText("Cargando diccionario…")).toBeTruthy();
    expect(actions.onTimedResponseStart).not.toHaveBeenCalled();
    await act(async () => resolve(words));
    expect(input().disabled).toBe(false);
    expect(document.activeElement).toBe(input());
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
    expect(input().disabled).toBe(true);
    expect(actions.onTimedResponseStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(input().disabled).toBe(false));
    expect(actions.onTimedResponseStart).toHaveBeenCalledTimes(1);
    expect(dictionary).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["AB", "Escribe una palabra de 5 letras."],
    ["ZZZZZ", "Esa palabra no está en la lista de intentos válidos."],
  ])("rejects %s without consuming or clearing it", async (value, error) => {
    const actions = callbacks();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await waitFor(() => expect(input().disabled).toBe(false));
    guess(value);
    expect(screen.getByText(error)).toBeTruthy();
    expect(input().value).toBe(value);
    expect(screen.getByText("Intento 1 de 4")).toBeTruthy();
    expect(actions.onProgress).not.toHaveBeenCalled();
    expect(actions.onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: "JOSUE" } });
    expect(screen.queryByText(error)).toBeNull();
  });

  it("normalizes accepted guesses, clears and refocuses input, then completes on the solution", async () => {
    const actions = callbacks();
    render(<MiniWordleQuestion {...practice} {...actions} />);
    await waitFor(() => expect(input().disabled).toBe(false));
    guess("cañón");
    expect(actions.onProgress).toHaveBeenLastCalledWith({ guesses: ["CAÑON"] });
    expect(actions.onSubmit).not.toHaveBeenCalled();
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
    guess("jesús");
    expect(actions.onSubmit).toHaveBeenCalledExactlyOnceWith({ guesses: ["CAÑON", "JESUS"] });
    expect(screen.getByLabelText("Intento 2: JESUS")).toBeTruthy();
  });

  it("restores progress and finishes when the last attempt is used", async () => {
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
    await waitFor(() => expect(input().disabled).toBe(false));
    guess("josué");
    expect(actions.onSubmit).toHaveBeenCalledExactlyOnceWith({ guesses: ["SALON", "JOSUE"] });
    expect(input().disabled).toBe(true);
    expect(screen.getByText("Intento 2 de 2")).toBeTruthy();
  });

  it("supports the four-letter defaults and locks without submitting", async () => {
    const actions = callbacks();
    const view = render(<MiniWordleQuestion correctAnswer="LUNA" locked={false} {...actions} />);
    await waitFor(() => expect(input().disabled).toBe(false));
    expect(input().maxLength).toBe(4);
    fireEvent.change(input(), { target: { value: "casa" } });
    view.rerender(<MiniWordleQuestion correctAnswer="LUNA" locked {...actions} />);
    fireEvent.submit(input().closest("form")!);
    expect(input().disabled).toBe(true);
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

describe("competitive Mini-Wordle interactions", () => {
  const base = {
    question: publicMiniWordle,
    progress: publicMiniWordle.progress,
    locked: false,
    submissionState: "idle" as const,
    submissionStatusVisible: false,
  };

  it("normalizes and clears on send, and waits for public server feedback", () => {
    const onSubmit = vi.fn();
    const view = render(<ServerMiniWordleQuestion {...base} onSubmit={onSubmit} />);
    guess("josué");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("JOSUE");
    expect(input().value).toBe("");
    expect(screen.queryByLabelText("Intento 1: JOSUE")).toBeNull();
    expect(dictionary).not.toHaveBeenCalled();
    const progress = {
      ...base.progress,
      attemptsUsed: 1,
      guesses: ["JOSUE"],
      feedback: [[{ letter: "J", status: "present" as const }]],
    };
    view.rerender(
      <ServerMiniWordleQuestion {...base} progress={progress} locked onSubmit={onSubmit} />,
    );
    expect(input().disabled).toBe(true);
    view.rerender(<ServerMiniWordleQuestion {...base} progress={progress} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("J: está en otra posición")).toBeTruthy();
    expect(screen.getByLabelText("Intento 1: JOSUE")).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(screen.getByText("Intento 2 de 4")).toBeTruthy();
  });

  it("shows definitive errors without adding a row and retries an uncertain submission", () => {
    const onSubmit = vi.fn();
    const onRetry = vi.fn();
    const view = render(
      <ServerMiniWordleQuestion
        {...base}
        onSubmit={onSubmit}
        submissionError="Palabra rechazada"
      />,
    );
    expect(screen.getByText("Palabra rechazada")).toBeTruthy();
    view.rerender(
      <ServerMiniWordleQuestion
        {...base}
        locked
        onSubmit={onSubmit}
        submissionState="error"
        submissionError="No confirmado"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    guess("SALON");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the exhausted board and accepts only its format-specific renderer props", () => {
    const onMiniWordleGuess = vi.fn();
    const question = {
      ...publicMiniWordle,
      progress: { ...publicMiniWordle.progress, attemptsUsed: 4 },
    };
    render(
      <MiniWordleInput
        question={question}
        locked={false}
        submissionState="idle"
        submissionStatusVisible={false}
        onMiniWordleGuess={onMiniWordleGuess}
      />,
    );
    expect(input().disabled).toBe(true);
    expect(screen.getByText("Intento 4 de 4")).toBeTruthy();
    expect(dictionary).not.toHaveBeenCalled();
  });
});
