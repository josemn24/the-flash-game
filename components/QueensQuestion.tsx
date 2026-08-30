"use client";

import { type KeyboardEvent, type MutableRefObject, useMemo, useRef, useState } from "react";
import { CrownIcon, CrossIcon, WarningIcon } from "@/components/icons";
import {
  calculateQueensMetrics,
  getQueensConflicts,
  QUEENS_CELL_COUNT,
  QUEENS_COLUMNS,
  QUEENS_ROWS,
  type QueensConflictType,
} from "@/lib/queens";
import type { QueensAnswer, QueensQuestion as QueensQuestionType } from "@/types/game";
import styles from "@/components/QueensQuestion.module.css";

type QueensTool = "queen" | "mark";

const CONFLICT_LABELS: Record<QueensConflictType, string> = {
  row: "fila repetida",
  column: "columna repetida",
  region: "región repetida",
  contact: "coronas en contacto",
};

function boundaryClasses(question: QueensQuestionType, cell: number) {
  const row = Math.floor(cell / QUEENS_COLUMNS);
  const column = cell % QUEENS_COLUMNS;
  const region = question.regions[cell];
  return [
    row === 0 || question.regions[cell - QUEENS_COLUMNS] !== region ? styles.regionTop : "",
    row === QUEENS_ROWS - 1 || question.regions[cell + QUEENS_COLUMNS] !== region
      ? styles.regionBottom
      : "",
    column === 0 || question.regions[cell - 1] !== region ? styles.regionLeft : "",
    column === QUEENS_COLUMNS - 1 || question.regions[cell + 1] !== region
      ? styles.regionRight
      : "",
  ].join(" ");
}

export function QueensBoard({
  question,
  answer,
  label,
  focusedCell,
  cellRefs,
  onCellAction,
  onCellFocus,
  onCellKeyDown,
}: {
  question: QueensQuestionType;
  answer: QueensAnswer;
  label: string;
  focusedCell?: number;
  cellRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  onCellAction?: (cell: number) => void;
  onCellFocus?: (cell: number) => void;
  onCellKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, cell: number) => void;
}) {
  const prefilledQueens = question.prefilledQueens ?? [];
  const visibleQueens = [...new Set([...prefilledQueens, ...answer.queens])].sort(
    (left, right) => left - right,
  );
  const conflicts = getQueensConflicts(question, visibleQueens);
  const interactive = Boolean(onCellAction);

  return (
    <div className={styles.board} role="grid" aria-label={label}>
      {Array.from({ length: QUEENS_CELL_COUNT }, (_, cell) => {
        const row = Math.floor(cell / QUEENS_COLUMNS) + 1;
        const column = (cell % QUEENS_COLUMNS) + 1;
        const prefilled = prefilledQueens.includes(cell);
        const queen = prefilled || answer.queens.includes(cell);
        const mark = !prefilled && answer.marks.includes(cell);
        const conflictTypes = [...(conflicts.get(cell) ?? [])];
        const state = prefilled
          ? "corona fija, pista"
          : queen
            ? "corona"
            : mark
              ? "marcada con X"
              : "vacía";
        const conflictLabel = conflictTypes.length
          ? `, conflicto: ${conflictTypes.map((type) => CONFLICT_LABELS[type]).join(", ")}`
          : "";
        const className = `${styles.cell} ${styles[`region${question.regions[cell]}`]} ${boundaryClasses(question, cell)} ${queen ? styles.queen : ""} ${prefilled ? styles.prefilledQueen : ""} ${mark ? styles.mark : ""} ${conflictTypes.length ? styles.conflict : ""}`;
        const content = (
          <>
            {queen && <CrownIcon className={styles.crownIcon} />}
            {prefilled && <span className={styles.prefilledLabel}>Pista</span>}
            {mark && <CrossIcon className={styles.markIcon} />}
            {conflictTypes.length > 0 && <WarningIcon className={styles.warningIcon} />}
          </>
        );

        return interactive ? (
          <button
            key={cell}
            ref={(element) => {
              if (cellRefs) cellRefs.current[cell] = element;
            }}
            type="button"
            role="gridcell"
            className={className}
            tabIndex={focusedCell === cell ? 0 : -1}
            aria-label={`Fila ${row}, columna ${column}, región ${question.regions[cell] + 1}: ${state}${conflictLabel}`}
            onClick={() => onCellAction?.(cell)}
            onFocus={() => onCellFocus?.(cell)}
            onKeyDown={(event) => onCellKeyDown?.(event, cell)}
          >
            {content}
          </button>
        ) : (
          <div
            key={cell}
            role="gridcell"
            className={className}
            aria-label={`Fila ${row}, columna ${column}, región ${question.regions[cell] + 1}: ${state}${conflictLabel}`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function QueensQuestion({
  question,
  initialAnswer,
  locked,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
  variant,
}: {
  question: QueensQuestionType;
  initialAnswer?: Partial<QueensAnswer>;
  locked: boolean;
  onProgress: (answer: QueensAnswer) => void;
  onIncorrectAttempt: () => void;
  onSubmit: (answer: QueensAnswer) => void;
  variant?: "flash-pop";
}) {
  const prefilledQueens = useMemo(() => question.prefilledQueens ?? [], [question.prefilledQueens]);
  const [answer, setAnswer] = useState<QueensAnswer>(() => ({
    queens: [
      ...new Set([
        ...prefilledQueens,
        ...(Array.isArray(initialAnswer?.queens) ? initialAnswer.queens : []),
      ]),
    ].sort((left, right) => left - right),
    marks: Array.isArray(initialAnswer?.marks)
      ? initialAnswer.marks.filter((cell) => !prefilledQueens.includes(cell))
      : [],
  }));
  const [tool, setTool] = useState<QueensTool>("queen");
  const [focusedCell, setFocusedCell] = useState(0);
  const [announcement, setAnnouncement] = useState("Herramienta Corona seleccionada.");
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const metrics = useMemo(() => calculateQueensMetrics(question, answer), [answer, question]);

  const publish = (nextAnswer: QueensAnswer, message: string, incorrect: boolean) => {
    setAnswer(nextAnswer);
    setAnnouncement(message);
    onProgress(nextAnswer);
    if (incorrect) onIncorrectAttempt();
    if (!locked && calculateQueensMetrics(question, nextAnswer).solved) onSubmit(nextAnswer);
  };

  const applyTool = (cell: number) => {
    if (locked) return;
    if (prefilledQueens.includes(cell)) {
      setAnnouncement("Esta corona es una pista fija y no se puede retirar.");
      return;
    }
    const hasQueen = answer.queens.includes(cell);
    const hasMark = answer.marks.includes(cell);
    if (tool === "queen") {
      const queens = hasQueen
        ? answer.queens.filter((candidate) => candidate !== cell)
        : [...answer.queens, cell].sort((left, right) => left - right);
      const nextAnswer = {
        queens,
        marks: hasMark ? answer.marks.filter((candidate) => candidate !== cell) : answer.marks,
      };
      const conflictTypes = hasQueen
        ? []
        : [...(getQueensConflicts(question, queens).get(cell) ?? [])];
      publish(
        nextAnswer,
        hasQueen
          ? `Corona eliminada de la casilla ${cell + 1}.`
          : conflictTypes.length
            ? `Corona en conflicto: ${conflictTypes.map((type) => CONFLICT_LABELS[type]).join(", ")}.`
            : `Corona colocada en la casilla ${cell + 1}.`,
        conflictTypes.length > 0,
      );
      return;
    }

    const marks = hasMark
      ? answer.marks.filter((candidate) => candidate !== cell)
      : [...answer.marks, cell].sort((left, right) => left - right);
    publish(
      {
        queens: hasQueen ? answer.queens.filter((candidate) => candidate !== cell) : answer.queens,
        marks,
      },
      hasMark ? `Marca eliminada de la casilla ${cell + 1}.` : `Casilla ${cell + 1} marcada con X.`,
      false,
    );
  };

  const selectTool = (nextTool: QueensTool) => {
    setTool(nextTool);
    setAnnouncement(`Herramienta ${nextTool === "queen" ? "Corona" : "Marcar X"} seleccionada.`);
    cellRefs.current[focusedCell]?.focus();
  };

  const clearCell = (cell: number) => {
    if (locked) return;
    if (prefilledQueens.includes(cell)) {
      setAnnouncement("Esta corona es una pista fija y no se puede retirar.");
      return;
    }
    if (!answer.queens.includes(cell) && !answer.marks.includes(cell)) return;
    publish(
      {
        queens: answer.queens.filter((candidate) => candidate !== cell),
        marks: answer.marks.filter((candidate) => candidate !== cell),
      },
      `Casilla ${cell + 1} vaciada.`,
      false,
    );
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / QUEENS_COLUMNS);
    const column = cell % QUEENS_COLUMNS;
    let nextCell: number | null = null;
    if (event.key === "ArrowUp" && row > 0) nextCell = cell - QUEENS_COLUMNS;
    if (event.key === "ArrowDown" && row < QUEENS_ROWS - 1) nextCell = cell + QUEENS_COLUMNS;
    if (event.key === "ArrowLeft" && column > 0) nextCell = cell - 1;
    if (event.key === "ArrowRight" && column < QUEENS_COLUMNS - 1) nextCell = cell + 1;
    if (nextCell !== null) {
      event.preventDefault();
      setFocusedCell(nextCell);
      cellRefs.current[nextCell]?.focus();
      return;
    }
    if (event.key.toLocaleLowerCase("es") === "c") {
      event.preventDefault();
      selectTool("queen");
    } else if (event.key.toLocaleLowerCase("es") === "x") {
      event.preventDefault();
      selectTool("mark");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearCell(cell);
    }
  };

  return (
    <section
      className={`${styles.root} ${variant === "flash-pop" ? styles.pop : ""}`}
      aria-label="Queens, puzzle de cinco coronas"
    >
      <div className={styles.toolbar} role="group" aria-label="Herramienta de marcado">
        <button
          type="button"
          className={tool === "queen" ? styles.toolActive : ""}
          aria-pressed={tool === "queen"}
          onClick={() => selectTool("queen")}
          disabled={locked}
        >
          <CrownIcon /> Corona <kbd>C</kbd>
        </button>
        <button
          type="button"
          className={tool === "mark" ? styles.toolActive : ""}
          aria-pressed={tool === "mark"}
          onClick={() => selectTool("mark")}
          disabled={locked}
        >
          <CrossIcon /> Marcar X <kbd>X</kbd>
        </button>
      </div>

      <QueensBoard
        question={question}
        answer={answer}
        label="Tablero Queens de cinco por cinco"
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onCellAction={applyTool}
        onCellFocus={setFocusedCell}
        onCellKeyDown={handleCellKeyDown}
      />

      <div className={styles.progress} aria-live="polite">
        <strong>{metrics.placedQueens}/5 coronas</strong>
        <span>
          {metrics.conflictingQueens
            ? `${metrics.conflictingQueens} en conflicto`
            : "Sin conflictos"}
        </span>
      </div>
      <p className={styles.instructions}>
        La corona marcada como pista es fija. Coloca una por fila, columna y región sin que se
        toquen.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
