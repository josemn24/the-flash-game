"use client";

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyZipCellSelection,
  calculateZipMetrics,
  isCompleteZipPath,
  ZIP_CELL_COUNT,
  ZIP_COLUMNS,
  ZIP_ROWS,
} from "@/lib/zip";
import type { QuestionVariant, ZipAnswer, ZipQuestion as ZipQuestionType } from "@/types/game";
import styles from "./ZipQuestion.module.css";

type Point = { x: number; y: number };

function pathPoints(path: number[]) {
  return path
    .map((cell) => `${(cell % ZIP_COLUMNS) + 0.5},${Math.floor(cell / ZIP_COLUMNS) + 0.5}`)
    .join(" ");
}

function neighborForKey(cell: number, key: string) {
  const row = Math.floor(cell / ZIP_COLUMNS);
  const column = cell % ZIP_COLUMNS;
  if (key === "ArrowUp" && row > 0) return cell - ZIP_COLUMNS;
  if (key === "ArrowDown" && row < ZIP_ROWS - 1) return cell + ZIP_COLUMNS;
  if (key === "ArrowLeft" && column > 0) return cell - 1;
  if (key === "ArrowRight" && column < ZIP_COLUMNS - 1) return cell + 1;
  return null;
}

export function ZipBoard({
  question,
  path,
  solutionPath,
  boardRef,
  onCellSelect,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  label = "Tablero Zip.",
  disabled = false,
}: {
  question: ZipQuestionType;
  path: number[];
  solutionPath?: number[];
  boardRef?: RefObject<HTMLDivElement | null>;
  onCellSelect?: (cell: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  label?: string;
  disabled?: boolean;
}) {
  const checkpoints = useMemo(
    () => new Map(question.checkpoints.map((checkpoint) => [checkpoint.cell, checkpoint])),
    [question.checkpoints],
  );
  const visited = new Set(path);
  const current = path.at(-1);
  const interactive = Boolean(onCellSelect) && !disabled;

  return (
    <div
      ref={boardRef}
      className={`${styles.board} ${interactive ? styles.boardInteractive : ""}`}
      role="grid"
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg
        className={styles.routeOverlay}
        viewBox={`0 0 ${ZIP_COLUMNS} ${ZIP_ROWS}`}
        aria-hidden="true"
      >
        {solutionPath && solutionPath.length > 1 && (
          <polyline className={styles.solutionRoute} points={pathPoints(solutionPath)} />
        )}
        {path.length > 1 && <polyline className={styles.playerRoute} points={pathPoints(path)} />}
      </svg>

      {Array.from({ length: ZIP_CELL_COUNT }, (_, cell) => {
        const row = Math.floor(cell / ZIP_COLUMNS) + 1;
        const column = (cell % ZIP_COLUMNS) + 1;
        const checkpoint = checkpoints.get(cell);
        const description = checkpoint
          ? `, punto ${checkpoint.value}${checkpoint.label ? `, ${checkpoint.label}` : ""}`
          : "";
        return (
          <div
            key={cell}
            className={`${styles.cell} ${visited.has(cell) ? styles.visited : ""} ${
              current === cell ? styles.current : ""
            } ${checkpoint ? styles.checkpoint : ""}`}
            role="gridcell"
            aria-label={`Fila ${row}, columna ${column}${description}${
              current === cell ? ", extremo actual" : visited.has(cell) ? ", recorrida" : ""
            }`}
          >
            {interactive ? (
              <button
                type="button"
                className={styles.cellButton}
                disabled={disabled}
                onClick={() => onCellSelect?.(cell)}
                aria-label={`Seleccionar fila ${row}, columna ${column}${description}`}
              >
                {checkpoint && <span className={styles.checkpointMarker}>{checkpoint.value}</span>}
              </button>
            ) : (
              checkpoint && <span className={styles.checkpointMarker}>{checkpoint.value}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ZipQuestion({
  question,
  locked,
  onProgress,
  onSubmit,
  variant,
}: {
  question: ZipQuestionType;
  locked: boolean;
  onProgress: (answer: ZipAnswer) => void;
  onSubmit: (answer: ZipAnswer) => void;
  variant?: QuestionVariant;
}) {
  const start = question.checkpoints[0].cell;
  const boardRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<number[]>([start]);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerPointRef = useRef<Point | null>(null);
  const [path, setPath] = useState([start]);
  const [announcement, setAnnouncement] = useState("Empieza en el número 1.");
  const metrics = useMemo(() => calculateZipMetrics(question, { path }), [path, question]);

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  const publishPath = (nextPath: number[], message: string) => {
    pathRef.current = nextPath;
    setPath(nextPath);
    setAnnouncement(message);
    const answer = { path: nextPath };
    onProgress(answer);
    if (!locked && isCompleteZipPath(question, nextPath)) onSubmit(answer);
  };

  const selectCell = (cell: number) => {
    if (locked) return;
    const result = applyZipCellSelection(question, pathRef.current, cell);
    if (result.changed) publishPath(result.path, result.message);
    else setAnnouncement(result.message);
  };

  const cellAtPoint = (point: Point) => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (
      point.x < rect.left ||
      point.x >= rect.right ||
      point.y < rect.top ||
      point.y >= rect.bottom
    ) {
      return null;
    }
    const column = Math.floor(((point.x - rect.left) / rect.width) * ZIP_COLUMNS);
    const row = Math.floor(((point.y - rect.top) / rect.height) * ZIP_ROWS);
    return row * ZIP_COLUMNS + column;
  };

  const tracePointerSegment = (from: Point, to: Point) => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const sampleDistance = Math.min(rect.width / ZIP_COLUMNS, rect.height / ZIP_ROWS) / 2;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / sampleDistance));
    let previousCell: number | null = null;
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      const cell = cellAtPoint({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      });
      if (cell !== null && cell !== previousCell) selectCell(cell);
      previousCell = cell;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    const point = { x: event.clientX, y: event.clientY };
    lastPointerPointRef.current = point;
    const cell = cellAtPoint(point);
    if (cell !== null) selectCell(cell);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || !lastPointerPointRef.current) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    tracePointerSegment(lastPointerPointRef.current, point);
    lastPointerPointRef.current = point;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
    lastPointerPointRef.current = null;
    boardRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = pathRef.current.at(-1) ?? start;
    const next = neighborForKey(current, event.key);
    if (next === null) return;
    event.preventDefault();
    selectCell(next);
  };

  const undo = () => {
    if (locked || pathRef.current.length <= 1) return;
    publishPath(pathRef.current.slice(0, -1), "Se ha deshecho el último paso.");
    boardRef.current?.focus();
  };

  const reset = () => {
    if (locked || pathRef.current.length <= 1) return;
    publishPath([start], "Camino reiniciado en el número 1.");
    boardRef.current?.focus();
  };

  return (
    <section
      className={styles.root}
      data-variant={variant ?? "default"}
      aria-label="Zip, una línea"
    >
      <div className={styles.header}>
        <strong>
          {metrics.coveredCells}/{metrics.totalCells} · {metrics.reachedCheckpoint}/
          {metrics.totalCheckpoints}
        </strong>
      </div>
      <ZipBoard
        question={question}
        path={path}
        boardRef={boardRef}
        onCellSelect={selectCell}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        disabled={locked}
        label={
          question.boardLabel ??
          "Tablero Zip. Arrastra, toca una celda adyacente o usa las flechas para extender el camino."
        }
      />
      {question.checkpoints.some((checkpoint) => checkpoint.label) && (
        <ol className={styles.legend} aria-label="Puntos de observación">
          {question.checkpoints.map((checkpoint) => (
            <li key={checkpoint.value}>
              <span>{checkpoint.value}</span>
              {checkpoint.label}
            </li>
          ))}
        </ol>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className={styles.actions}>
        <button type="button" disabled={locked || path.length <= 1} onClick={undo}>
          Deshacer
        </button>
        <button type="button" disabled={locked || path.length <= 1} onClick={reset}>
          Reiniciar
        </button>
      </div>
      <p className={styles.instructions}>Usa cada celda una sola vez.</p>
    </section>
  );
}
