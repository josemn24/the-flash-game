// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueensQuestion as PracticeQuestion } from "@/types/gameplay/practice";
import type { ServerQueensQuestion as ServerQuestion } from "@/types/gameplay/challenge";
import { guide } from "@/features/question-formats/formats/queens/guide";
import { QueensQuestion } from "./QueensQuestion";
import { ServerQueensQuestion } from "./ServerQueensQuestion";

const question: PracticeQuestion = { ...guide.examples[0].question, prefilledQueens: [2] };
const almostSolved = [2, 9, 10, 18];
const solution = [2, 9, 10, 18, 21];

function cell(index: number) {
  return screen.getByRole("gridcell", {
    name: new RegExp(`Fila ${Math.floor(index / 5) + 1}, columna ${(index % 5) + 1},`),
  });
}
function place(index: number) {
  fireEvent.click(cell(index));
  fireEvent.click(cell(index));
}
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}
function setup(mode: "practice" | "session", queens = [2]) {
  const onProgress = vi.fn();
  const onDraft = vi.fn();
  const onValidate = vi.fn();
  const onIncorrectAttempt = vi.fn();
  const onSubmit = vi.fn();
  const onRetry = vi.fn();
  const node = ({
    locked = false,
    validationState = "idle",
    incorrectValidations = 0,
    id = question.id,
  }: {
    locked?: boolean;
    validationState?: "idle" | "submitting" | "error";
    incorrectValidations?: number;
    id?: string;
  } = {}) => {
    const progress = {
      kind: "queens" as const,
      queens,
      placedQueens: queens.length,
      completedRows: 0,
      completedColumns: 0,
      completedRegions: 0,
      conflictingQueens: 0,
      solved: false,
      incorrectValidations,
      maxIncorrectValidations: 3,
    };
    const { solution: omittedSolution, ...publicQuestion } = question;
    void omittedSolution;
    return (
      <StrictMode>
        {mode === "practice" ? (
          <QueensQuestion
            question={{ ...question, id }}
            initialAnswer={{ queens, marks: [] }}
            locked={locked}
            onProgress={onProgress}
            onIncorrectAttempt={onIncorrectAttempt}
            onSubmit={onSubmit}
          />
        ) : (
          <ServerQueensQuestion
            question={{ ...publicQuestion, id, progress } as ServerQuestion}
            progress={progress}
            locked={locked}
            validationState={validationState}
            validationStatusVisible={validationState === "error"}
            validationError={validationState === "error" ? "Sin conexión" : undefined}
            onDraft={onDraft}
            onValidate={onValidate}
            onRetry={onRetry}
          />
        )}
      </StrictMode>
    );
  };
  const view = render(node());
  return {
    ...view,
    update: (overrides: Parameters<typeof node>[0]) => view.rerender(node(overrides)),
    onProgress,
    onDraft,
    onValidate,
    onIncorrectAttempt,
    onSubmit,
    onRetry,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(["practice", "session"] as const)("Queens %s", (mode) => {
  it("cycles empty → X → crown → empty and replaces the selector with help below the board", () => {
    const calls = setup(mode);
    const board = screen.getByRole("grid");
    expect(board.nextElementSibling?.textContent).toBe(
      "Cada toque cambia la casilla: vacía → X → corona → vacía.",
    );
    expect(screen.queryByRole("group", { name: "Herramienta de marcado" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Colocar corona" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar casilla con X" })).toBeNull();
    fireEvent.click(cell(0));
    expect(cell(0).getAttribute("aria-label")).toContain("marcada con X");
    expect(calls.onDraft).not.toHaveBeenCalled();
    fireEvent.click(cell(0));
    expect(cell(0).getAttribute("aria-label")).toContain("corona");
    fireEvent.click(cell(0));
    expect(cell(0).getAttribute("aria-label")).toContain("vacía");
    advance(2000);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onIncorrectAttempt).not.toHaveBeenCalled();
    if (mode === "practice")
      expect(calls.onProgress).toHaveBeenLastCalledWith({ queens: [2], marks: [] });
    else expect(calls.onDraft).toHaveBeenLastCalledWith([2]);
  });

  it("keeps fixed hints immutable and announces the reason", () => {
    const calls = setup(mode);
    fireEvent.click(cell(2));
    fireEvent.keyDown(cell(2), { key: "Delete" });
    expect(cell(2).getAttribute("aria-label")).toContain("corona fija, pista");
    expect(screen.getByText("Esta corona es una pista fija y no se puede retirar.")).toBeTruthy();
    expect(calls.onDraft).not.toHaveBeenCalled();
    expect(calls.onProgress).not.toHaveBeenCalled();
  });

  it("navigates with arrows and clears marks and crowns directly with the keyboard", () => {
    setup(mode);
    cell(0).focus();
    fireEvent.keyDown(cell(0), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(1));
    fireEvent.keyDown(cell(1), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell(6));
    fireEvent.click(cell(6));
    fireEvent.keyDown(cell(6), { key: "Backspace" });
    expect(cell(6).getAttribute("aria-label")).toContain("vacía");
    place(6);
    fireEvent.keyDown(cell(6), { key: "Delete" });
    expect(cell(6).getAttribute("aria-label")).toContain("vacía");
  });

  it("does not penalize an incomplete conflicting board", () => {
    const calls = setup(mode);
    place(0);
    expect(cell(0).getAttribute("aria-label")).toContain("conflicto");
    advance(5000);
    expect(calls.onIncorrectAttempt).not.toHaveBeenCalled();
    expect(calls.onValidate).not.toHaveBeenCalled();
  });

  it("cancels validation when erasing an X through a temporary final crown", () => {
    const calls = setup(mode, almostSolved);
    place(20);
    advance(799);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onIncorrectAttempt).not.toHaveBeenCalled();
    fireEvent.click(cell(20));
    advance(5000);
    expect(cell(20).getAttribute("aria-label")).toContain("vacía");
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onIncorrectAttempt).not.toHaveBeenCalled();
    expect(calls.onSubmit).not.toHaveBeenCalled();
    if (mode === "session")
      expect(screen.getByLabelText("3 de 3 intentos restantes en este tablero")).toBeTruthy();
  });

  it("waits 800 ms without restarting on rerenders and validates exactly once", () => {
    const calls = setup(mode, almostSolved);
    place(21);
    advance(400);
    calls.update({});
    advance(399);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onSubmit).not.toHaveBeenCalled();
    advance(1);
    if (mode === "practice")
      expect(calls.onSubmit).toHaveBeenCalledExactlyOnceWith({ queens: solution, marks: [] });
    else expect(calls.onValidate).toHaveBeenCalledExactlyOnceWith(solution);
    advance(5000);
    expect(mode === "practice" ? calls.onSubmit : calls.onValidate).toHaveBeenCalledOnce();
    expect(calls.onIncorrectAttempt).not.toHaveBeenCalled();
  });

  it("postpones a pending validation on mark edits, skips extra crowns, and does not validate marks alone", () => {
    const calls = setup(mode, almostSolved);
    place(21);
    advance(500);
    fireEvent.click(cell(0));
    advance(500);
    fireEvent.click(cell(0));
    expect(cell(0).getAttribute("aria-label")).toContain("vacía");
    expect(screen.getByText("5/5", { exact: true })).toBeTruthy();
    advance(799);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onSubmit).not.toHaveBeenCalled();
    advance(1);
    const validate = mode === "practice" ? calls.onSubmit : calls.onValidate;
    expect(validate).toHaveBeenCalledOnce();
    fireEvent.click(cell(0));
    fireEvent.click(cell(0));
    advance(2000);
    expect(validate).toHaveBeenCalledOnce();
  });

  it("does not validate a restored full board or a progress rerender", () => {
    const calls = setup(mode, solution);
    calls.update({});
    advance(5000);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onSubmit).not.toHaveBeenCalled();
  });

  it.each(["lock", "question", "unmount"])("cancels pending validation on %s", (change) => {
    const calls = setup(mode, almostSolved);
    place(21);
    advance(500);
    if (change === "unmount") calls.unmount();
    else calls.update(change === "lock" ? { locked: true } : { id: "next-question" });
    advance(5000);
    expect(calls.onValidate).not.toHaveBeenCalled();
    expect(calls.onSubmit).not.toHaveBeenCalled();
  });

  it("evaluates an incorrect full board once instead of penalizing individual conflicts", () => {
    const calls = setup(mode, almostSolved);
    place(20);
    advance(800);
    if (mode === "practice") expect(calls.onIncorrectAttempt).toHaveBeenCalledOnce();
    else expect(calls.onValidate).toHaveBeenCalledExactlyOnceWith([2, 9, 10, 18, 20]);
    expect(calls.onSubmit).not.toHaveBeenCalled();
    calls.update({ incorrectValidations: 1 });
    advance(5000);
    expect(
      mode === "practice" ? calls.onIncorrectAttempt : calls.onValidate,
    ).toHaveBeenCalledOnce();
  });
});

describe("Queens session confirmations", () => {
  it("counts hints absent from progress, and only shows confirmed attempts", () => {
    const calls = setup("session", [9, 10, 18, 21]);
    expect(screen.getByText("5/5", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("3 de 3 intentos restantes en este tablero")).toBeTruthy();
    calls.update({ incorrectValidations: 1 });
    expect(screen.getByLabelText("2 de 3 intentos restantes en este tablero")).toBeTruthy();
    calls.update({ incorrectValidations: 2, validationState: "error" });
    expect(screen.getByLabelText("1 de 3 intentos restantes en este tablero")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar validación" }));
    expect(calls.onRetry).toHaveBeenCalledOnce();
    advance(2000);
    expect(calls.onValidate).not.toHaveBeenCalled();
  });

  it("blocks edits while submitting and after exhaustion and cancels the pending timer", () => {
    const calls = setup("session", almostSolved);
    place(21);
    calls.update({ validationState: "submitting" });
    fireEvent.click(cell(21));
    expect((cell(21) as HTMLButtonElement).disabled).toBe(true);
    advance(2000);
    expect(calls.onValidate).not.toHaveBeenCalled();
    calls.update({ incorrectValidations: 3 });
    fireEvent.click(cell(21));
    expect((cell(21) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.onDraft).toHaveBeenCalledOnce();
  });
});
