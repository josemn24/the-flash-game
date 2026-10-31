"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import { QueensBoard, QueensFooter, QueensInteractionHelp, QueensStatus } from "./QueensQuestion";
import type {
  ServerQueensProgress,
  ServerQueensQuestion as ServerQuestion,
} from "@/types/gameplay/challenge";
import { getQueensConflicts } from "@/lib/queens";
import { useQueensInteraction } from "./useQueensInteraction";
import styles from "./QueensQuestion.module.css";

export function QueensSessionQuestion({
  question,
  progress,
  locked,
  validationState,
  validationStatusVisible,
  validationError,
  onDraft,
  onValidate,
  onRetry,
}: {
  readonly question: ServerQuestion;
  readonly progress: ServerQueensProgress;
  readonly locked: boolean;
  readonly validationState: "idle" | "submitting" | "error";
  readonly validationStatusVisible: boolean;
  readonly validationError?: string;
  readonly onDraft: (queens: readonly number[]) => void;
  readonly onValidate: (queens: readonly number[]) => void;
  readonly onRetry?: () => void;
}) {
  const [focusedCell, setFocusedCell] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const remainingAttempts =
    progress.maxIncorrectValidations === null
      ? null
      : Math.max(0, progress.maxIncorrectValidations - progress.incorrectValidations);
  const disabled = locked || validationState === "submitting" || remainingAttempts === 0;
  const targetQueens = question.grid.rows;
  const { answer, announcement, cycleCell, clearCell } = useQueensInteraction({
    question,
    questionId: question.id,
    initialAnswer: { queens: [...progress.queens] },
    disabled,
    onProgress: (nextAnswer, queensChanged) => {
      if (queensChanged) onDraft(nextAnswer.queens);
    },
    onValidate: (nextAnswer) => onValidate(nextAnswer.queens),
  });
  const conflicts = useMemo(
    () => getQueensConflicts(question, answer.queens),
    [answer.queens, question],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / question.grid.columns);
    const column = cell % question.grid.columns;
    const nextCell =
      event.key === "ArrowUp" && row > 0
        ? cell - question.grid.columns
        : event.key === "ArrowDown" && row < question.grid.rows - 1
          ? cell + question.grid.columns
          : event.key === "ArrowLeft" && column > 0
            ? cell - 1
            : event.key === "ArrowRight" && column < question.grid.columns - 1
              ? cell + 1
              : null;
    if (nextCell !== null) {
      event.preventDefault();
      setFocusedCell(nextCell);
      cellRefs.current[nextCell]?.focus();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearCell(cell);
    }
  };

  return (
    <section className={styles.root} aria-label={`Queens, puzzle de ${targetQueens} coronas`}>
      <QueensStatus
        placedQueens={answer.queens.length}
        targetQueens={targetQueens}
        remainingAttempts={remainingAttempts}
        totalAttempts={progress.maxIncorrectValidations}
      />
      <QueensBoard
        question={question}
        answer={answer}
        label={`Tablero Queens de ${question.grid.rows} por ${question.grid.columns}`}
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onCellAction={cycleCell}
        onCellFocus={setFocusedCell}
        onCellKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <QueensInteractionHelp />
      <QueensFooter targetQueens={targetQueens} conflictingQueens={conflicts.size} />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <ServerOperationStatus
        state={validationState}
        visible={validationStatusVisible}
        pendingMessage="Validando tablero…"
        errorMessage={validationError ?? "No hemos podido validar el tablero."}
        retryLabel="Reintentar validación"
        onRetry={onRetry}
      />
      {validationState === "idle" && validationError ? (
        <p className="mt-4" role="status" aria-live="polite">
          {validationError}
        </p>
      ) : null}
    </section>
  );
}
