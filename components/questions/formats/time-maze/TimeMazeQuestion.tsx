"use client";

import { motion } from "motion/react";
import { KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { BoltIcon } from "@/components/ui";
import {
  getTimeMazeExitIndex,
  getTimeMazeNeighbor,
  getTimeMazeStartIndex,
  type MazeDirection,
} from "@/lib/timeMaze";
import type {
  QuestionVariant,
  TimeMazeAnswer,
  TimeMazeQuestion as TimeMazeQuestionType,
} from "@/types/game";
import styles from "./TimeMazeQuestion.module.css";

const DIRECTION_LABELS: Record<MazeDirection, string> = {
  up: "arriba",
  right: "derecha",
  down: "abajo",
  left: "izquierda",
};

const KEY_DIRECTIONS: Record<string, MazeDirection> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

function pathPoints(path: number[], columns: number) {
  return path
    .map((position) => `${(position % columns) + 0.5},${Math.floor(position / columns) + 0.5}`)
    .join(" ");
}

export function TimeMazeBoard({
  question,
  path,
  optimalPath,
  boardRef,
  onKeyDown,
  label = "Laberinto. Usa las flechas del teclado o la cruceta para llegar a la salida.",
}: {
  question: TimeMazeQuestionType;
  path: number[];
  optimalPath?: number[];
  boardRef?: RefObject<HTMLDivElement | null>;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  label?: string;
}) {
  const { rows, columns } = question.grid;
  const currentPosition = path.at(-1) ?? getTimeMazeStartIndex(question);
  const visited = new Set(path);

  return (
    <div
      ref={boardRef}
      className={`${styles.board} ${onKeyDown ? styles.boardInteractive : ""}`}
      style={{
        aspectRatio: `${columns} / ${rows}`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label={label}
      tabIndex={onKeyDown ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      {question.cells.map((cell, index) => {
        const row = Math.floor(index / columns) + 1;
        const column = (index % columns) + 1;
        const current = index === currentPosition;
        const label =
          cell === "wall"
            ? `Fila ${row}, columna ${column}: muro`
            : cell === "start"
              ? `Fila ${row}, columna ${column}: entrada`
              : cell === "exit"
                ? `Fila ${row}, columna ${column}: salida`
                : `Fila ${row}, columna ${column}: camino`;
        return (
          <div
            key={index}
            className={`${styles.cell} ${styles[cell]} ${visited.has(index) ? styles.visited : ""}`}
            role="gridcell"
            aria-label={`${label}${current ? ", posición actual" : ""}`}
          >
            {cell === "start" && <span className={styles.marker}>S</span>}
            {cell === "exit" && <span className={styles.marker}>E</span>}
            {current && (
              <span className={styles.player} aria-hidden="true">
                <BoltIcon className="h-4 w-4" />
              </span>
            )}
          </div>
        );
      })}

      <svg className={styles.routeOverlay} viewBox={`0 0 ${columns} ${rows}`} aria-hidden="true">
        {path.length > 1 && (
          <polyline className={styles.playerRoute} points={pathPoints(path, columns)} />
        )}
        {optimalPath && optimalPath.length > 1 && (
          <polyline className={styles.optimalRoute} points={pathPoints(optimalPath, columns)} />
        )}
      </svg>
    </div>
  );
}

export function TimeMazeQuestion({
  question,
  locked,
  onProgress,
  onSubmit,
  variant,
}: {
  question: TimeMazeQuestionType;
  locked: boolean;
  onProgress: (answer: TimeMazeAnswer) => void;
  onSubmit: (answer: TimeMazeAnswer) => void;
  variant?: QuestionVariant;
}) {
  const start = getTimeMazeStartIndex(question);
  const exit = getTimeMazeExitIndex(question);
  const boardRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState([start]);
  const [announcement, setAnnouncement] = useState("Estás en la entrada del laberinto.");
  const position = path.at(-1) ?? start;
  const moves = path.length - 1;
  const availableMoves = useMemo(
    () =>
      new Map<MazeDirection, number | null>(
        (["up", "right", "down", "left"] as MazeDirection[]).map((direction) => [
          direction,
          getTimeMazeNeighbor(question, position, direction),
        ]),
      ),
    [position, question],
  );

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  const move = (direction: MazeDirection) => {
    if (locked) return;
    const nextPosition = availableMoves.get(direction) ?? null;
    if (nextPosition === null) {
      setAnnouncement(`No puedes avanzar hacia ${DIRECTION_LABELS[direction]}. Hay un muro.`);
      return;
    }

    const nextPath = [...path, nextPosition];
    const answer = { path: nextPath };
    setPath(nextPath);
    onProgress(answer);
    boardRef.current?.focus();
    const row = Math.floor(nextPosition / question.grid.columns) + 1;
    const column = (nextPosition % question.grid.columns) + 1;
    setAnnouncement(
      nextPosition === exit
        ? `Salida alcanzada en ${nextPath.length - 1} movimientos.`
        : `Fila ${row}, columna ${column}. ${nextPath.length - 1} movimientos.`,
    );
    if (nextPosition === exit) onSubmit(answer);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEY_DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  };

  return (
    <section
      className={styles.root}
      data-variant={variant ?? "default"}
      aria-label="Laberinto contrarreloj"
    >
      <div className={styles.header}>
        <span>Llega de S a E</span>
        <strong>{moves} movimientos</strong>
      </div>
      <TimeMazeBoard
        question={question}
        path={path}
        boardRef={boardRef}
        onKeyDown={handleKeyDown}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div
        className={styles.controls}
        role="group"
        aria-label="Controles del laberinto"
        onKeyDown={handleKeyDown}
      >
        {(["up", "left", "down", "right"] as MazeDirection[]).map((direction) => (
          <motion.button
            key={direction}
            type="button"
            className={styles[direction]}
            disabled={locked || availableMoves.get(direction) === null}
            onClick={() => move(direction)}
            whileTap={{ scale: 0.94 }}
            aria-label={`Mover ${DIRECTION_LABELS[direction]}`}
          >
            <span aria-hidden="true">
              {direction === "up"
                ? "↑"
                : direction === "right"
                  ? "→"
                  : direction === "down"
                    ? "↓"
                    : "←"}
            </span>
          </motion.button>
        ))}
      </div>
      <p className={styles.instructions}>
        Usa la cruceta o las flechas del teclado. Puedes retroceder; los movimientos no restan
        puntos.
      </p>
    </section>
  );
}
