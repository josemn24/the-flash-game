"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import {
  findWordSearchTarget,
  getWordSearchPath,
  getWordSearchTargetPath,
  normalizeWordSearchText,
} from "@/lib/wordSearch";
import type { WordSearchAnswer, WordSearchQuestion as WordSearchQuestionType } from "@/types/game";
import styles from "@/components/WordSearchQuestion.module.css";

type BoardProps = {
  question: WordSearchQuestionType;
  foundWordIds: string[];
  previewCells?: number[];
  invalidCells?: number[];
  revealSolution?: boolean;
  activeCell?: number;
  interactive?: boolean;
  locked?: boolean;
  cellRefs?: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  onCellClick?: (cell: number) => void;
  onCellKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, cell: number) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function cellsForTargets(question: WordSearchQuestionType, targetIds: Set<string>) {
  return new Set(
    question.targets.flatMap((target) =>
      targetIds.has(target.id) ? (getWordSearchTargetPath(question, target) ?? []) : [],
    ),
  );
}

export function WordSearchBoard({
  question,
  foundWordIds,
  previewCells = [],
  invalidCells = [],
  revealSolution = false,
  activeCell = 0,
  interactive = false,
  locked = false,
  cellRefs,
  onCellClick,
  onCellKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BoardProps) {
  const foundIds = useMemo(() => new Set(foundWordIds), [foundWordIds]);
  const foundCells = useMemo(() => cellsForTargets(question, foundIds), [foundIds, question]);
  const missingIds = useMemo(
    () =>
      new Set(
        question.targets.filter((target) => !foundIds.has(target.id)).map((target) => target.id),
      ),
    [foundIds, question.targets],
  );
  const missingCells = useMemo(
    () => (revealSolution ? cellsForTargets(question, missingIds) : new Set<number>()),
    [missingIds, question, revealSolution],
  );
  const preview = new Set(previewCells);
  const invalid = new Set(invalidCells);

  return (
    <div
      className={`${styles.board} ${interactive ? styles.boardInteractive : ""}`}
      style={{ "--word-search-columns": question.grid.columns } as CSSProperties}
      role="grid"
      aria-label={`Sopa de letras de ${question.grid.rows} filas y ${question.grid.columns} columnas`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {question.letters.map((letter, cell) => {
        const row = Math.floor(cell / question.grid.columns) + 1;
        const column = (cell % question.grid.columns) + 1;
        const found = foundCells.has(cell);
        const missing = missingCells.has(cell);
        const selected = preview.has(cell);
        const rejected = invalid.has(cell);
        const stateLabel = found
          ? ", pertenece a una palabra encontrada"
          : missing
            ? ", pertenece a una palabra pendiente"
            : selected
              ? ", seleccionada"
              : "";
        const state = found
          ? "found"
          : missing
            ? "missing"
            : selected
              ? "preview"
              : rejected
                ? "invalid"
                : "idle";
        const className = `${styles.cell} ${found ? styles.cellFound : ""} ${missing ? styles.cellMissing : ""} ${selected ? styles.cellPreview : ""} ${rejected ? styles.cellInvalid : ""}`;
        const content = <span>{normalizeWordSearchText(letter)}</span>;
        return (
          <div
            key={cell}
            className={className}
            role="gridcell"
            aria-selected={selected || found}
            data-state={state}
          >
            {interactive ? (
              <button
                ref={(node) => {
                  if (cellRefs) cellRefs.current[cell] = node;
                }}
                type="button"
                tabIndex={cell === activeCell ? 0 : -1}
                disabled={locked}
                aria-label={`Fila ${row}, columna ${column}, letra ${normalizeWordSearchText(letter)}${stateLabel}`}
                data-cell={cell}
                onClick={() => onCellClick?.(cell)}
                onKeyDown={(event) => onCellKeyDown?.(event, cell)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}

function cellFromPointer(
  question: WordSearchQuestionType,
  board: HTMLDivElement,
  x: number,
  y: number,
) {
  const rect = board.getBoundingClientRect();
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
  const column = Math.floor(((x - rect.left) / rect.width) * question.grid.columns);
  const row = Math.floor(((y - rect.top) / rect.height) * question.grid.rows);
  return row * question.grid.columns + column;
}

function neighborForKey(question: WordSearchQuestionType, cell: number, key: string) {
  const row = Math.floor(cell / question.grid.columns);
  const column = cell % question.grid.columns;
  if (key === "ArrowUp" && row > 0) return cell - question.grid.columns;
  if (key === "ArrowDown" && row < question.grid.rows - 1) return cell + question.grid.columns;
  if (key === "ArrowLeft" && column > 0) return cell - 1;
  if (key === "ArrowRight" && column < question.grid.columns - 1) return cell + 1;
  return null;
}

export function WordSearchQuestion({
  question,
  initialAnswer,
  locked,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
  className,
}: {
  question: WordSearchQuestionType;
  initialAnswer?: WordSearchAnswer;
  locked: boolean;
  onProgress: (answer: WordSearchAnswer) => void;
  onIncorrectAttempt: () => void;
  onSubmit: (answer: WordSearchAnswer) => void;
  className?: string;
}) {
  const validTargetIds = useMemo(
    () => new Set(question.targets.map((target) => target.id)),
    [question.targets],
  );
  const initialFound = (initialAnswer?.foundWordIds ?? []).filter((id) => validTargetIds.has(id));
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const invalidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const pointerEndRef = useRef<number | null>(null);
  const ignoreClickCellRef = useRef<number | null>(null);
  const [foundWordIds, setFoundWordIds] = useState(initialFound);
  const [anchorCell, setAnchorCell] = useState<number | null>(null);
  const [previewCells, setPreviewCells] = useState<number[]>([]);
  const [invalidCells, setInvalidCells] = useState<number[]>([]);
  const [activeCell, setActiveCell] = useState(0);
  const [announcement, setAnnouncement] = useState(
    "Selecciona la primera y la última letra de una palabra.",
  );

  useEffect(
    () => () => {
      if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current);
    },
    [],
  );

  const cancelSelection = (message = "Selección cancelada.") => {
    setAnchorCell(null);
    setPreviewCells([]);
    setAnnouncement(message);
  };

  const showInvalidSelection = (cells: number[], message: string) => {
    if (invalidTimeoutRef.current) clearTimeout(invalidTimeoutRef.current);
    setInvalidCells(cells);
    setAnnouncement(message);
    invalidTimeoutRef.current = setTimeout(() => setInvalidCells([]), 520);
  };

  const completeSelection = (startCell: number, endCell: number) => {
    const path = getWordSearchPath(question.grid, startCell, endCell) ?? [];
    const target = findWordSearchTarget(question, startCell, endCell);
    setAnchorCell(null);
    setPreviewCells([]);

    if (!target) {
      onIncorrectAttempt();
      showInvalidSelection(path, "La selección no forma una palabra objetivo.");
      return;
    }
    if (foundWordIds.includes(target.id)) {
      setAnnouncement(`${target.word} ya estaba encontrada.`);
      return;
    }

    const nextFound = [...foundWordIds, target.id];
    const answer = { foundWordIds: nextFound };
    setFoundWordIds(nextFound);
    onProgress(answer);
    setAnnouncement(
      `Palabra encontrada: ${target.word}. ${nextFound.length} de ${question.targets.length}.`,
    );
    if (!locked && nextFound.length === question.targets.length) onSubmit(answer);
  };

  const selectCell = (cell: number) => {
    if (locked) return;
    setActiveCell(cell);
    if (anchorCell === null) {
      setAnchorCell(cell);
      setPreviewCells([cell]);
      setAnnouncement(
        `Inicio en fila ${Math.floor(cell / question.grid.columns) + 1}, columna ${(cell % question.grid.columns) + 1}. Selecciona el final.`,
      );
      return;
    }
    if (anchorCell === cell) {
      cancelSelection();
      return;
    }
    completeSelection(anchorCell, cell);
  };

  const handleCellClick = (cell: number) => {
    if (ignoreClickCellRef.current === cell) {
      ignoreClickCellRef.current = null;
      return;
    }
    selectCell(cell);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || event.button !== 0) return;
    const cell = cellFromPointer(question, event.currentTarget, event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    pointerStartRef.current = cell;
    pointerEndRef.current = cell;
    ignoreClickCellRef.current = cell;
    setActiveCell(cell);
    cellRefs.current[cell]?.focus();
    setPreviewCells([cell]);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || pointerStartRef.current === null) return;
    event.preventDefault();
    const cell = cellFromPointer(question, event.currentTarget, event.clientX, event.clientY);
    if (cell === null || cell === pointerEndRef.current) return;
    pointerEndRef.current = cell;
    setPreviewCells(
      getWordSearchPath(question.grid, pointerStartRef.current, cell) ?? [pointerStartRef.current],
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || pointerStartRef.current === null) return;
    event.preventDefault();
    const startCell = pointerStartRef.current;
    const endCell =
      cellFromPointer(question, event.currentTarget, event.clientX, event.clientY) ??
      pointerEndRef.current ??
      startCell;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
    pointerStartRef.current = null;
    pointerEndRef.current = null;
    if (startCell === endCell) selectCell(startCell);
    else completeSelection(startCell, endCell);
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const neighbor = neighborForKey(question, cell, event.key);
    if (neighbor !== null) {
      event.preventDefault();
      setActiveCell(neighbor);
      cellRefs.current[neighbor]?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCell(cell);
      return;
    }
    if (event.key === "Escape" && anchorCell !== null) {
      event.preventDefault();
      cancelSelection();
    }
  };

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label="Sopa de letras">
      <div className={styles.header}>
        <span>Palabras</span>
        <strong>
          {foundWordIds.length} / {question.targets.length}
        </strong>
      </div>
      <ul className="sr-only" aria-label="Palabras objetivo">
        {question.targets.map((target) => {
          const found = foundWordIds.includes(target.id);
          return (
            <li key={target.id} className={found ? styles.wordFound : ""}>
              {found ? <CheckIcon aria-hidden="true" /> : <span aria-hidden="true">•</span>}
              <span>{target.word}</span>
              <span className="sr-only">{found ? "encontrada" : "pendiente"}</span>
            </li>
          );
        })}
      </ul>
      <WordSearchBoard
        question={question}
        foundWordIds={foundWordIds}
        previewCells={previewCells}
        invalidCells={invalidCells}
        activeCell={activeCell}
        interactive
        locked={locked}
        cellRefs={cellRefs}
        onCellClick={handleCellClick}
        onCellKeyDown={handleCellKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <p className={styles.instructions}>
        Arrastra entre los extremos o selecciónalos con dos toques. Con teclado, usa las flechas y
        Enter o Espacio.
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
