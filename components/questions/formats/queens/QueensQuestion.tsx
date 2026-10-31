"use client";

import { type KeyboardEvent, type MutableRefObject, useMemo, useRef, useState } from "react";
import { CrossIcon, QueensCrownIcon, WarningIcon } from "@/components/ui";
import { LifeHearts } from "@/components/questions/shared/LifeHearts";
import {
  calculateQueensMetrics,
  getQueensConflicts,
  queensCellCount,
  type QueensConflictType,
} from "@/lib/queens";
import type {
  QueensAnswer,
  QueensGrid,
  QueensQuestion as QueensQuestionType,
} from "@/types/gameplay/practice";
import { useQueensInteraction } from "./useQueensInteraction";
import styles from "./QueensQuestion.module.css";

export type QueensBoardQuestion = {
  grid: QueensGrid;
  regions: readonly number[];
  prefilledQueens?: readonly number[];
};

const CONFLICT_LABELS: Record<QueensConflictType, string> = {
  row: "fila repetida",
  column: "columna repetida",
  region: "región repetida",
  contact: "coronas en contacto",
};

export function QueensBoard({
  question,
  answer,
  label,
  focusedCell,
  cellRefs,
  onCellAction,
  onCellFocus,
  onCellKeyDown,
  disabled = false,
}: {
  question: QueensBoardQuestion;
  answer: QueensAnswer;
  label: string;
  focusedCell?: number;
  cellRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  onCellAction?: (cell: number) => void;
  onCellFocus?: (cell: number) => void;
  onCellKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, cell: number) => void;
  disabled?: boolean;
}) {
  const prefilledQueens = question.prefilledQueens ?? [];
  const visibleQueens = [...new Set([...prefilledQueens, ...answer.queens])].sort(
    (left, right) => left - right,
  );
  const conflicts = getQueensConflicts(question, visibleQueens);
  const interactive = Boolean(onCellAction);
  const columns = question.grid.columns;

  return (
    <div
      className={styles.board}
      role="grid"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: queensCellCount(question.grid) }, (_, cell) => {
        const row = Math.floor(cell / columns) + 1;
        const column = (cell % columns) + 1;
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
        const className = `${styles.cell} ${styles[`region${question.regions[cell]}`]} ${queen ? styles.queen : ""} ${prefilled ? styles.prefilledQueen : ""} ${mark ? styles.mark : ""} ${conflictTypes.length ? styles.conflict : ""}`;
        const content = (
          <>
            {queen && <QueensCrownIcon className={styles.queensCrownIcon} />}
            {prefilled && <span className={styles.prefilledLabel}>Pista</span>}
            {mark && <CrossIcon className={styles.markIcon} viewBox="4 4 16 16" />}
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
            disabled={disabled}
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

export function QueensStatus({
  placedQueens,
  targetQueens,
  remainingAttempts,
  totalAttempts,
}: {
  placedQueens: number;
  targetQueens: number;
  remainingAttempts?: number | null;
  totalAttempts?: number | null;
}) {
  return (
    <div className={styles.statusRow}>
      <span
        className={styles.crownProgress}
        role="status"
        aria-label="Progreso de coronas"
        aria-live="polite"
        aria-atomic="true"
      >
        <QueensCrownIcon className={styles.progressCrown} />
        <strong>
          {placedQueens}/{targetQueens}
        </strong>
        <span className="sr-only">coronas colocadas</span>
      </span>
      {remainingAttempts != null && totalAttempts != null ? (
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          title={`${totalAttempts} intentos por tablero. Se renuevan al avanzar.`}
        >
          <LifeHearts
            livesRemaining={remainingAttempts}
            totalLives={totalAttempts}
            ariaLabel={`${remainingAttempts} de ${totalAttempts} intentos restantes en este tablero`}
            className={styles.attemptsCapsule}
            emphasizeLastLife
          />
        </span>
      ) : null}
    </div>
  );
}

export function QueensFooter({
  targetQueens,
  conflictingQueens,
}: {
  targetQueens: number;
  conflictingQueens: number;
}) {
  return (
    <div className={styles.footer}>
      {conflictingQueens > 0 ? (
        <p className={styles.conflictNotice} role="status" aria-live="polite">
          {conflictingQueens === 1
            ? "1 corona en conflicto"
            : `${conflictingQueens} coronas en conflicto`}
        </p>
      ) : null}
      <p className={styles.instructions}>
        Se valida al completar las {targetQueens} coronas y dejar de editar un instante.
      </p>
    </div>
  );
}

export function QueensInteractionHelp() {
  return (
    <p className={styles.interactionHelp}>
      Cada toque cambia la casilla: vacía → X → corona → vacía.
    </p>
  );
}

export function QueensQuestion({
  question,
  initialAnswer,
  locked,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: {
  question: QueensQuestionType;
  initialAnswer?: Partial<QueensAnswer>;
  locked: boolean;
  onProgress: (answer: QueensAnswer) => void;
  onIncorrectAttempt: () => void;
  onSubmit: (answer: QueensAnswer) => void;
}) {
  const [focusedCell, setFocusedCell] = useState(0);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { answer, announcement, cycleCell, clearCell } = useQueensInteraction({
    question,
    questionId: question.id,
    initialAnswer,
    disabled: locked,
    onProgress: (nextAnswer) => onProgress(nextAnswer),
    onValidate: (nextAnswer) => {
      if (calculateQueensMetrics(question, nextAnswer).solved) onSubmit(nextAnswer);
      else onIncorrectAttempt();
    },
  });
  const metrics = useMemo(() => calculateQueensMetrics(question, answer), [answer, question]);

  const handleCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / question.grid.columns);
    const column = cell % question.grid.columns;
    let nextCell: number | null = null;
    if (event.key === "ArrowUp" && row > 0) nextCell = cell - question.grid.columns;
    if (event.key === "ArrowDown" && row < question.grid.rows - 1)
      nextCell = cell + question.grid.columns;
    if (event.key === "ArrowLeft" && column > 0) nextCell = cell - 1;
    if (event.key === "ArrowRight" && column < question.grid.columns - 1) nextCell = cell + 1;
    if (nextCell !== null) {
      event.preventDefault();
      setFocusedCell(nextCell);
      cellRefs.current[nextCell]?.focus();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      clearCell(cell);
    }
  };

  return (
    <section
      className={`${styles.root}`}
      aria-label={`Queens, puzzle de ${question.grid.rows} coronas`}
    >
      <QueensStatus placedQueens={metrics.placedQueens} targetQueens={question.grid.rows} />
      <QueensBoard
        question={question}
        answer={answer}
        label={`Tablero Queens de ${question.grid.rows} por ${question.grid.columns}`}
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onCellAction={cycleCell}
        onCellFocus={setFocusedCell}
        onCellKeyDown={handleCellKeyDown}
        disabled={locked}
      />

      <QueensInteractionHelp />

      <QueensFooter
        targetQueens={question.grid.rows}
        conflictingQueens={metrics.conflictingQueens}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
