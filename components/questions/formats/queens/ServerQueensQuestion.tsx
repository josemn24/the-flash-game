"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { CrownIcon, CrossIcon } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
import { QueensBoard } from "./QueensQuestion";
import type {
  ServerQueensProgress,
  ServerQueensQuestion as ServerQuestion,
} from "@/types/gameplay/challenge";
import { getQueensConflicts } from "@/lib/queens";
import styles from "./QueensQuestion.module.css";

type QueensTool = "queen" | "mark";

export function ServerQueensQuestion({
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
  const [draftQueens, setDraftQueens] = useState<number[]>(() => [...progress.queens]);
  const [marks, setMarks] = useState<number[]>([]);
  const [tool, setTool] = useState<QueensTool>("queen");
  const [focusedCell, setFocusedCell] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const conflicts = useMemo(
    () => getQueensConflicts(question, [...new Set([...question.prefilledQueens, ...draftQueens])]),
    [draftQueens, question],
  );
  const disabled = locked || validationState === "submitting";
  const targetQueens = question.grid.rows;

  const publishQueens = (nextQueens: number[]) => {
    setDraftQueens(nextQueens);
    onDraft(nextQueens);
    if (draftQueens.length < targetQueens && nextQueens.length === targetQueens)
      onValidate(nextQueens);
  };

  const applyAction = (cell: number) => {
    if (disabled || question.prefilledQueens.includes(cell)) return;
    const hasQueen = draftQueens.includes(cell);
    if (tool === "mark") {
      setMarks((current) =>
        current.includes(cell)
          ? current.filter((candidate) => candidate !== cell)
          : [...current, cell].sort((a, b) => a - b),
      );
      return;
    }
    setMarks((current) => current.filter((candidate) => candidate !== cell));
    publishQueens(
      hasQueen
        ? draftQueens.filter((candidate) => candidate !== cell)
        : [...draftQueens, cell].sort((a, b) => a - b),
    );
  };

  const clearCell = (cell: number) => {
    if (disabled || question.prefilledQueens.includes(cell)) return;
    if (draftQueens.includes(cell))
      publishQueens(draftQueens.filter((candidate) => candidate !== cell));
    else setMarks((current) => current.filter((candidate) => candidate !== cell));
  };

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
    } else if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      setTool("queen");
    } else if (event.key.toLowerCase() === "x") {
      event.preventDefault();
      setTool("mark");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearCell(cell);
    }
  };

  return (
    <section className={styles.root} aria-label={`Queens, puzzle de ${targetQueens} coronas`}>
      <div className={styles.toolbar} role="group" aria-label="Herramienta de marcado">
        <button
          type="button"
          className={tool === "queen" ? styles.toolActive : ""}
          aria-pressed={tool === "queen"}
          onClick={() => setTool("queen")}
          disabled={disabled}
        >
          <CrownIcon /> Corona <kbd>C</kbd>
        </button>
        <button
          type="button"
          className={tool === "mark" ? styles.toolActive : ""}
          aria-pressed={tool === "mark"}
          onClick={() => setTool("mark")}
          disabled={disabled}
        >
          <CrossIcon /> Marcar X <kbd>X</kbd>
        </button>
      </div>
      <QueensBoard
        question={question}
        answer={{ queens: [...draftQueens], marks }}
        label={`Tablero Queens de ${question.grid.rows} por ${question.grid.columns}`}
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onCellAction={applyAction}
        onCellFocus={setFocusedCell}
        onCellKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <div className={styles.progress} aria-live="polite">
        <strong>
          {draftQueens.length}/{targetQueens} coronas
        </strong>
        <span>{conflicts.size ? `${conflicts.size} en conflicto` : "Sin conflictos"}</span>
      </div>
      <p className={styles.instructions}>
        La corona marcada como pista es fija. Coloca una por fila, columna y región sin que se
        toquen. El tablero se valida automáticamente al colocar las {targetQueens} coronas.
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
