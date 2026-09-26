"use client";

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import {
  applyZipCellSelection,
  calculateZipMetrics,
  isCompleteZipPath,
  isValidZipPath,
  ZIP_COLUMNS,
  ZIP_ROWS,
} from "@/lib/zip";
import type { ZipAnswer } from "@/types/game";
import type { ServerZipQuestion as ServerQuestion } from "@/types/gameplay/challenge";
import { ZipBoard } from "./ZipQuestion";
import styles from "./ZipQuestion.module.css";

type Point = { x: number; y: number };

function neighborForKey(cell: number, key: string) {
  const row = Math.floor(cell / ZIP_COLUMNS);
  const column = cell % ZIP_COLUMNS;
  if (key === "ArrowUp" && row > 0) return cell - ZIP_COLUMNS;
  if (key === "ArrowDown" && row < ZIP_ROWS - 1) return cell + ZIP_COLUMNS;
  if (key === "ArrowLeft" && column > 0) return cell - 1;
  if (key === "ArrowRight" && column < ZIP_COLUMNS - 1) return cell + 1;
  return null;
}

export function ServerZipQuestion({
  question,
  initialAnswer,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetry,
  onProgress,
  onSubmit,
}: {
  readonly question: ServerQuestion;
  readonly initialAnswer?: ZipAnswer | null;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetry?: () => void;
  readonly onProgress: (answer: ZipAnswer) => void;
  readonly onSubmit: (answer: ZipAnswer) => void;
}) {
  const start = question.checkpoints[0]?.cell ?? 0;
  const boardRef = useRef<HTMLDivElement>(null);
  const initialPath =
    initialAnswer && isValidZipPath(question, initialAnswer.path) ? initialAnswer.path : [start];
  const pathRef = useRef<number[]>(initialPath);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerPointRef = useRef<Point | null>(null);
  const [path, setPath] = useState(initialPath);
  const [announcement, setAnnouncement] = useState("Empieza en el número 1.");
  const metrics = calculateZipMetrics(question, { path });

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
    lastPointerPointRef.current = { x: event.clientX, y: event.clientY };
    const cell = cellAtPoint({ x: event.clientX, y: event.clientY });
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

  const statusVisible =
    submissionState === "error" || (submissionState === "submitting" && submissionStatusVisible);

  return (
    <section className={styles.root} aria-label="Zip, una línea">
      <ZipBoard
        question={{ ...question, boardLabel: question.boardLabel ?? undefined }}
        path={path}
        boardRef={boardRef}
        onCellSelect={selectCell}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        disabled={locked}
        label={question.boardLabel ?? "Tablero Zip. Usa las flechas, el tacto o el arrastre."}
      />
      {question.checkpoints.some((checkpoint) => checkpoint.label) ? (
        <ol className={styles.legend} aria-label="Puntos de observación">
          {question.checkpoints.map((checkpoint) => (
            <li key={checkpoint.value}>
              <span>{checkpoint.value}</span>
              {checkpoint.label}
            </li>
          ))}
        </ol>
      ) : null}
      <div className={styles.serverMetrics} aria-label="Progreso del recorrido">
        <span>
          {metrics.coveredCells}/{metrics.totalCells} celdas
        </span>
        <span>
          {metrics.reachedCheckpoint}/{metrics.totalCheckpoints} checkpoints
        </span>
      </div>
      <p className={styles.instructions}>
        {question.instruction ?? "Usa cada celda una sola vez."}
      </p>
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
      {statusVisible ? (
        <ServerOperationStatus
          state={submissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando recorrido…"
          errorMessage={submissionError ?? "No hemos podido confirmar el recorrido."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      ) : null}
    </section>
  );
}
