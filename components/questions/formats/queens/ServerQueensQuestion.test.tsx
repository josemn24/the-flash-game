// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ServerQueensProgress,
  ServerQueensQuestion as ServerQuestion,
} from "@/types/gameplay/challenge";
import { ServerQueensQuestion } from "./ServerQueensQuestion";

const question: ServerQuestion = {
  id: "queens-question",
  type: "queens",
  category: "Lógica",
  tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] },
  question: "Coloca cinco coronas.",
  timeLimit: 60,
  points: 50,
  grid: { rows: 5, columns: 5 },
  regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
  prefilledQueens: [2],
  progress: {
    kind: "queens",
    queens: [2, 5, 16, 21, 24],
    placedQueens: 5,
    completedRows: 5,
    completedColumns: 5,
    completedRegions: 5,
    conflictingQueens: 0,
    solved: false,
  },
};

const progress: ServerQueensProgress = question.progress;

afterEach(cleanup);

describe("ServerQueensQuestion", () => {
  it("does not add a sixth queen or send a command, and keeps removal explicit", () => {
    const onDraft = vi.fn();
    const onValidate = vi.fn();
    render(
      <ServerQueensQuestion
        question={question}
        progress={progress}
        locked={false}
        validationState="idle"
        validationStatusVisible={false}
        onDraft={onDraft}
        onValidate={onValidate}
      />,
    );

    fireEvent.click(screen.getByRole("gridcell", { name: /Fila 1, columna 1/ }));

    expect(onDraft).not.toHaveBeenCalled();
    expect(onValidate).not.toHaveBeenCalled();
    expect(screen.getByText("5/5 coronas")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Ya tienes cinco coronas. Retira una antes de colocar otra.",
    );

    fireEvent.click(screen.getByRole("gridcell", { name: /Fila 5, columna 5/ }));
    expect(onDraft).toHaveBeenLastCalledWith([2, 5, 16, 21]);
    expect(
      screen.queryByText("Ya tienes cinco coronas. Retira una antes de colocar otra."),
    ).toBeNull();

    fireEvent.click(screen.getByRole("gridcell", { name: /Fila 1, columna 1/ }));
    expect(onDraft).toHaveBeenLastCalledWith([0, 2, 5, 16, 21]);
    expect(onValidate).toHaveBeenCalledWith([0, 2, 5, 16, 21]);
  });

  it("supports removing a queen with the keyboard", () => {
    const onDraft = vi.fn();
    render(
      <ServerQueensQuestion
        question={question}
        progress={progress}
        locked={false}
        validationState="idle"
        validationStatusVisible={false}
        onDraft={onDraft}
        onValidate={vi.fn()}
      />,
    );

    const queenCell = screen.getByRole("gridcell", { name: /Fila 5, columna 5/ });
    fireEvent.keyDown(queenCell, { key: "Delete" });

    expect(onDraft).toHaveBeenCalledWith([2, 5, 16, 21]);
    expect(screen.getByText("4/5 coronas")).toBeTruthy();
  });

  it("counts a prefilled queen even when it is absent from progress", () => {
    const onDraft = vi.fn();
    const questionWithoutPrefilledProgress = {
      ...question,
      progress: { ...question.progress, queens: [5, 16, 21, 24], placedQueens: 4 },
    } satisfies ServerQuestion;
    render(
      <ServerQueensQuestion
        question={questionWithoutPrefilledProgress}
        progress={questionWithoutPrefilledProgress.progress}
        locked={false}
        validationState="idle"
        validationStatusVisible={false}
        onDraft={onDraft}
        onValidate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("gridcell", { name: /Fila 1, columna 1/ }));

    expect(onDraft).not.toHaveBeenCalled();
    expect(screen.getByText("5/5 coronas")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Ya tienes cinco coronas. Retira una antes de colocar otra.",
    );
  });
});
