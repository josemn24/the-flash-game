"use client";

import { type KeyboardEvent, type MutableRefObject, useMemo, useRef, useState } from "react";
import {
  calculatePipesMetrics,
  getPipesConnectedCells,
  getPipesConnections,
  rotatePipesTile,
  type PipeDirection,
} from "@/lib/pipes";
import type { PipesAnswer, PipesQuestion as PipesQuestionType, PipesTileKind } from "@/types/game";
import styles from "./PipesQuestion.module.css";

const KIND_LABEL: Record<PipesTileKind, string> = {
  end: "extremo",
  straight: "tubería recta",
  corner: "curva",
  tee: "bifurcación",
};
const DIRECTION_LABEL: Record<PipeDirection, string> = {
  north: "norte",
  east: "este",
  south: "sur",
  west: "oeste",
};

function pathFor(connections: PipeDirection[]) {
  const segments: Record<PipeDirection, string> = {
    north: "M50 50V8",
    east: "M50 50H92",
    south: "M50 50V92",
    west: "M50 50H8",
  };
  return connections.map((direction) => segments[direction]).join(" ");
}

function neighborForKey(cell: number, key: string) {
  const row = Math.floor(cell / 5);
  const column = cell % 5;
  if (key === "ArrowUp" && row > 0) return cell - 5;
  if (key === "ArrowDown" && row < 4) return cell + 5;
  if (key === "ArrowLeft" && column > 0) return cell - 1;
  if (key === "ArrowRight" && column < 4) return cell + 1;
  return null;
}

export function PipesBoard({
  question,
  answer,
  label,
  focusedCell,
  cellRefs,
  onRotate,
  onFocus,
  onKeyDown,
}: {
  question: PipesQuestionType;
  answer: PipesAnswer;
  label: string;
  focusedCell?: number;
  cellRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  onRotate?: (cell: number) => void;
  onFocus?: (cell: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, cell: number) => void;
}) {
  const metrics = useMemo(() => calculatePipesMetrics(question, answer), [answer, question]);
  const connectedCells = useMemo(
    () => (metrics.valid ? getPipesConnectedCells(question, answer.rotations) : new Set<number>()),
    [answer.rotations, metrics.valid, question],
  );
  const interactive = Boolean(onRotate);

  return (
    <div className={styles.board} role="grid" aria-label={label}>
      {question.tiles.map((kind, cell) => {
        const row = Math.floor(cell / 5) + 1;
        const column = (cell % 5) + 1;
        const connections = getPipesConnections(kind, answer.rotations[cell]);
        const connected = connectedCells.has(cell);
        const isSource = cell === question.source;
        const directionLabel = connections
          .map((direction) => DIRECTION_LABEL[direction])
          .join(", ");
        const className = `${styles.cell} ${connected ? styles.connected : ""} ${
          isSource ? styles.source : ""
        }`;
        const graphic = (
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path className={styles.pipe} d={pathFor(connections)} />
            <circle className={styles.joint} cx="50" cy="50" r="8" />
            {isSource && <circle className={styles.sourceCore} cx="50" cy="50" r="13" />}
          </svg>
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
            aria-label={`Fila ${row}, columna ${column}: ${KIND_LABEL[kind]}, conectada hacia ${directionLabel}${
              isSource ? ", fuente" : ""
            }`}
            onClick={() => onRotate?.(cell)}
            onFocus={() => onFocus?.(cell)}
            onKeyDown={(event) => onKeyDown?.(event, cell)}
          >
            {graphic}
          </button>
        ) : (
          <div
            key={cell}
            role="gridcell"
            className={className}
            aria-label={`Fila ${row}, columna ${column}`}
          >
            {graphic}
          </div>
        );
      })}
    </div>
  );
}

export function PipesQuestion({
  question,
  locked,
  onProgress,
  onSubmit,
}: {
  question: PipesQuestionType;
  locked: boolean;
  onProgress: (answer: PipesAnswer) => void;
  onSubmit: (answer: PipesAnswer) => void;
}) {
  const [answer, setAnswer] = useState<PipesAnswer>({
    rotations: question.initialRotations,
    moves: 0,
  });
  const [focusedCell, setFocusedCell] = useState(0);
  const [announcement, setAnnouncement] = useState("Rota las piezas para conectar toda la red.");
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const metrics = useMemo(() => calculatePipesMetrics(question, answer), [answer, question]);

  const publish = (nextAnswer: PipesAnswer, message: string) => {
    setAnswer(nextAnswer);
    setAnnouncement(message);
    onProgress(nextAnswer);
    if (!locked && calculatePipesMetrics(question, nextAnswer).solved) onSubmit(nextAnswer);
  };

  const rotate = (cell: number) => {
    if (locked) return;
    const nextAnswer = {
      rotations: rotatePipesTile(answer.rotations, cell),
      moves: answer.moves + 1,
    };
    const solved = calculatePipesMetrics(question, nextAnswer).solved;
    publish(
      nextAnswer,
      solved
        ? "Red completa conectada. Puzzle resuelto."
        : `Pieza de la casilla ${cell + 1} rotada.`,
    );
  };

  const reset = () => {
    if (locked || answer.moves === 0) return;
    publish({ rotations: question.initialRotations, moves: 0 }, "Tablero reiniciado.");
    cellRefs.current[focusedCell]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const nextCell = neighborForKey(cell, event.key);
    if (nextCell !== null) {
      event.preventDefault();
      setFocusedCell(nextCell);
      cellRefs.current[nextCell]?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      rotate(cell);
    }
  };

  return (
    <section className={styles.root} aria-label="Tuberías, conecta toda la red">
      <div className={styles.header}>
        <span>Conecta toda la red</span>
        <strong>{answer.moves} giros</strong>
      </div>
      <PipesBoard
        question={question}
        answer={answer}
        label="Tablero de Tuberías. Toca una pieza o usa Enter para girarla."
        focusedCell={focusedCell}
        cellRefs={cellRefs}
        onRotate={rotate}
        onFocus={setFocusedCell}
        onKeyDown={handleKeyDown}
      />
      <div className={styles.progress} aria-live="polite">
        <strong>
          {metrics.connectedTiles}/{metrics.totalTiles} conectadas
        </strong>
        <span>
          {metrics.openConnections
            ? `${metrics.openConnections} conexiones abiertas`
            : "Red cerrada"}
        </span>
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={locked || answer.moves === 0} onClick={reset}>
          Reiniciar
        </button>
      </div>
      <p className={styles.instructions}>
        Toca cada pieza para rotarla. No puede quedar ninguna salida abierta.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
