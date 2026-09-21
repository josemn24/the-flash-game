"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { CrownIcon, CrossIcon } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
import { QueensBoard } from "./QueensQuestion";
import type {
  ServerQueensProgress,
  ServerQueensQuestion as ServerQuestion,
} from "@/types/gameplay/challenge";
import { getQueensConflicts, QUEENS_COLUMNS, QUEENS_ROWS } from "@/lib/queens";
import styles from "./QueensQuestion.module.css";

type QueensTool = "queen" | "mark";

export function ServerQueensQuestion({
  question,
  progress,
  locked,
  placementState,
  placementStatusVisible,
  placementError,
  onPlace,
  onRetry,
}: {
  readonly question: ServerQuestion;
  readonly progress: ServerQueensProgress;
  readonly locked: boolean;
  readonly placementState: "idle" | "submitting" | "error";
  readonly placementStatusVisible: boolean;
  readonly placementError?: string;
  readonly onPlace: (cell: number, action: "place" | "remove") => void;
  readonly onRetry?: () => void;
}) {
  const [marks, setMarks] = useState<number[]>([]);
  const [tool, setTool] = useState<QueensTool>("queen");
  const [focusedCell, setFocusedCell] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const queens = progress.queens;
  const conflicts = useMemo(
    () => getQueensConflicts(question, [...new Set([...question.prefilledQueens, ...queens])]),
    [queens, question],
  );

  const applyAction = (cell: number) => {
    if (locked || question.prefilledQueens.includes(cell)) return;
    const hasQueen = queens.includes(cell);
    if (tool === "mark") {
      setMarks((current) =>
        current.includes(cell)
          ? current.filter((candidate) => candidate !== cell)
          : [...current.filter((candidate) => candidate !== cell), cell].sort((a, b) => a - b),
      );
      return;
    }
    setMarks((current) => current.filter((candidate) => candidate !== cell));
    onPlace(cell, hasQueen ? "remove" : "place");
  };

  const clearCell = (cell: number) => {
    if (locked || question.prefilledQueens.includes(cell)) return;
    if (queens.includes(cell)) applyAction(cell);
    else setMarks((current) => current.filter((candidate) => candidate !== cell));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / QUEENS_COLUMNS);
    const column = cell % QUEENS_COLUMNS;
    const nextCell =
      event.key === "ArrowUp" && row > 0
        ? cell - QUEENS_COLUMNS
        : event.key === "ArrowDown" && row < QUEENS_ROWS - 1
          ? cell + QUEENS_COLUMNS
          : event.key === "ArrowLeft" && column > 0
            ? cell - 1
            : event.key === "ArrowRight" && column < QUEENS_COLUMNS - 1
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
    <section className={styles.root} aria-label="Queens, puzzle de cinco coronas">
      <div className={styles.toolbar} role="group" aria-label="Herramienta de marcado">
        <button
          type="button"
          className={tool === "queen" ? styles.toolActive : ""}
          aria-pressed={tool === "queen"}
          onClick={() => setTool("queen")}
          disabled={locked}
        >
          <CrownIcon /> Corona <kbd>C</kbd>
        </button>
        <button
          type="button"
          className={tool === "mark" ? styles.toolActive : ""}
          aria-pressed={tool === "mark"}
          onClick={() => setTool("mark")}
          disabled={locked}
        >
          <CrossIcon /> Marcar X <kbd>X</kbd>
        </button>
      </div>
      <QueensBoard
        question={question}
        answer={{ queens: [...queens], marks }}
        label="Tablero Queens de cinco por cinco"
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onCellAction={applyAction}
        onCellFocus={setFocusedCell}
        onCellKeyDown={handleKeyDown}
        disabled={locked}
      />
      <div className={styles.progress} aria-live="polite">
        <strong>{progress.placedQueens}/5 coronas</strong>
        <span>{conflicts.size ? `${conflicts.size} en conflicto` : "Sin conflictos"}</span>
      </div>
      <p className={styles.instructions}>
        La corona marcada como pista es fija. Coloca una por fila, columna y región sin que se
        toquen.
      </p>
      <ServerOperationStatus
        state={placementState}
        visible={placementStatusVisible}
        pendingMessage="Guardando movimiento…"
        errorMessage={placementError ?? "No hemos podido guardar el movimiento."}
        retryLabel="Reintentar movimiento"
        onRetry={onRetry}
      />
      {placementState === "idle" && placementError ? (
        <p className="mt-4" role="status" aria-live="polite">
          {placementError}
        </p>
      ) : null}
    </section>
  );
}
