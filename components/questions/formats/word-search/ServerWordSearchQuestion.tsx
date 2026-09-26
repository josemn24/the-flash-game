"use client";

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import { CheckIcon } from "@/components/ui";
import { getWordSearchPath } from "@/lib/wordSearch";
import type { ServerWordSearchQuestion as ServerQuestion } from "@/types/gameplay/challenge";
import { WordSearchBoard } from "./WordSearchQuestion";
import styles from "./WordSearchQuestion.module.css";

type Selection = { readonly startCell: number; readonly endCell: number };

export function ServerWordSearchQuestion({
  question,
  progress,
  locked,
  selectionState,
  selectionStatusVisible,
  selectionError,
  lastSelection,
  onSelect,
  onRetry,
}: {
  readonly question: ServerQuestion;
  readonly progress: ServerQuestion["progress"];
  readonly locked: boolean;
  readonly selectionState: "idle" | "submitting" | "error";
  readonly selectionStatusVisible: boolean;
  readonly selectionError?: string;
  readonly lastSelection?: Selection & { readonly correct: boolean };
  readonly onSelect: (startCell: number, endCell: number) => void;
  readonly onRetry?: () => void;
}) {
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pointerId = useRef<number | null>(null);
  const pointerStart = useRef<number | null>(null);
  const pointerEnd = useRef<number | null>(null);
  const ignoreClick = useRef<number | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [preview, setPreview] = useState<number[]>([]);
  const [activeCell, setActiveCell] = useState(0);
  const [announcement, setAnnouncement] = useState("Selecciona la primera y la última letra de una palabra.");

  const cancel = (message = "Selección cancelada.") => {
    setAnchor(null);
    setPreview([]);
    setAnnouncement(message);
  };

  const complete = (startCell: number, endCell: number) => {
    const path = getWordSearchPath(question.grid, startCell, endCell);
    setAnchor(null);
    setPreview([]);
    if (!path) {
      setAnnouncement("La selección debe ser horizontal, vertical o diagonal.");
      return;
    }
    setAnnouncement("Comprobando selección…");
    onSelect(startCell, endCell);
  };

  const selectCell = (cell: number) => {
    if (locked) return;
    setActiveCell(cell);
    if (anchor === null) {
      setAnchor(cell);
      setPreview([cell]);
      setAnnouncement(`Inicio en fila ${Math.floor(cell / question.grid.columns) + 1}, columna ${(cell % question.grid.columns) + 1}. Selecciona el final.`);
    } else if (anchor === cell) {
      cancel();
    } else {
      complete(anchor, cell);
    }
  };

  const cellFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return null;
    const column = Math.floor(((event.clientX - rect.left) / rect.width) * question.grid.columns);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * question.grid.rows);
    return row * question.grid.columns + column;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || event.button !== 0) return;
    const cell = cellFromPointer(event);
    if (cell === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerId.current = event.pointerId;
    pointerStart.current = cell;
    pointerEnd.current = cell;
    ignoreClick.current = cell;
    setActiveCell(cell);
    cellRefs.current[cell]?.focus();
    setPreview([cell]);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId || pointerStart.current === null) return;
    const cell = cellFromPointer(event);
    if (cell === null || cell === pointerEnd.current) return;
    event.preventDefault();
    pointerEnd.current = cell;
    setPreview(getWordSearchPath(question.grid, pointerStart.current, cell) ?? [pointerStart.current]);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId || pointerStart.current === null) return;
    event.preventDefault();
    const startCell = pointerStart.current;
    const endCell = cellFromPointer(event) ?? pointerEnd.current ?? startCell;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerId.current = null;
    pointerStart.current = null;
    pointerEnd.current = null;
    if (startCell === endCell) selectCell(startCell);
    else complete(startCell, endCell);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / question.grid.columns);
    const column = cell % question.grid.columns;
    const neighbor = event.key === "ArrowUp" && row > 0
      ? cell - question.grid.columns
      : event.key === "ArrowDown" && row < question.grid.rows - 1
        ? cell + question.grid.columns
        : event.key === "ArrowLeft" && column > 0
          ? cell - 1
          : event.key === "ArrowRight" && column < question.grid.columns - 1
            ? cell + 1
            : null;
    if (neighbor !== null) {
      event.preventDefault();
      setActiveCell(neighbor);
      cellRefs.current[neighbor]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCell(cell);
    } else if (event.key === "Escape" && anchor !== null) {
      event.preventDefault();
      cancel();
    }
  };

  const boardQuestion = { grid: question.grid, letters: question.letters, targets: question.targets };
  const foundIds = progress.foundWordIds;
  const responseInvalid = lastSelection && !lastSelection.correct
    ? getWordSearchPath(question.grid, lastSelection.startCell, lastSelection.endCell) ?? []
    : [];
  const statusVisible = selectionState === "error" || (selectionState === "submitting" && selectionStatusVisible);

  return (
    <section className={styles.root} aria-label="Sopa de letras">
      <div className={styles.header}>
        <span>Palabras</span>
        <strong>{progress.foundCount} / {progress.totalWords}</strong>
        <span aria-label="Selecciones incorrectas">
          {progress.incorrectAttempts} {progress.incorrectAttempts === 1 ? "error" : "errores"}
        </span>
      </div>
      <ul className="sr-only" aria-label="Palabras objetivo">
        {question.targets.map((target) => (
          <li key={target.id} className={foundIds.includes(target.id) ? styles.wordFound : ""}>
            {foundIds.includes(target.id) ? <CheckIcon aria-hidden="true" /> : <span aria-hidden="true">•</span>}
            <span>{target.word}</span>
            <span className="sr-only">{foundIds.includes(target.id) ? "encontrada" : "pendiente"}</span>
          </li>
        ))}
      </ul>
      <WordSearchBoard
        question={boardQuestion}
        foundWordIds={foundIds}
        foundSelections={progress.foundSelections}
        previewCells={preview}
        invalidCells={responseInvalid}
        activeCell={activeCell}
        interactive
        locked={locked}
        cellRefs={cellRefs}
        onCellClick={(cell) => {
          if (ignoreClick.current === cell) { ignoreClick.current = null; return; }
          selectCell(cell);
        }}
        onCellKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <p className={styles.instructions}>Arrastra entre los extremos o selecciónalos con dos toques. Con teclado, usa las flechas y Enter o Espacio.</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {statusVisible ? (
        <ServerOperationStatus
          state={selectionState}
          visible={selectionStatusVisible}
          pendingMessage="Comprobando selección…"
          errorMessage={selectionError ?? "No hemos podido guardar la selección."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      ) : null}
    </section>
  );
}
