"use client";

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useMemo, useRef, useState } from "react";
import styles from "@/components/WordHashtagQuestion.module.css";
import {
  applyWordHashtagSwap,
  buildWordHashtagSolution,
  calculateWordHashtagMetrics,
  isWordHashtagAnswer,
  replayWordHashtagSwaps,
} from "@/lib/wordHashtag";
import type {
  WordHashtagAnswer,
  WordHashtagQuestion as WordHashtagQuestionType,
} from "@/types/game";

type Props = {
  question: WordHashtagQuestionType;
  initialAnswer?: WordHashtagAnswer;
  locked: boolean;
  onProgress: (answer: WordHashtagAnswer) => void;
  onSubmit: (answer: WordHashtagAnswer) => void;
  className?: string;
};

type DragState = {
  pointerId: number;
  sourceCell: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function initialSwaps(question: WordHashtagQuestionType, answer?: WordHashtagAnswer) {
  if (!isWordHashtagAnswer(answer)) return [];
  return replayWordHashtagSwaps(question, answer.swaps).valid ? answer.swaps : [];
}

function cellFromPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  const cell = element?.closest<HTMLElement>("[data-word-hashtag-cell]");
  const value = cell?.dataset.wordHashtagCell;
  return value === undefined ? null : Number(value);
}

export function WordHashtagQuestion({
  question,
  initialAnswer,
  locked,
  onProgress,
  onSubmit,
  className,
}: Props) {
  const [answer, setAnswer] = useState<WordHashtagAnswer>(() => ({
    swaps: initialSwaps(question, initialAnswer),
  }));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const cellRefs = useRef(new Map<number, HTMLButtonElement>());
  const solution = useMemo(() => buildWordHashtagSolution(question.words)!, [question.words]);
  const replay = useMemo(
    () => replayWordHashtagSwaps(question, answer.swaps),
    [answer.swaps, question],
  );
  const metrics = useMemo(() => calculateWordHashtagMetrics(question, answer), [answer, question]);
  const remainingMoves = Math.max(0, question.maxMoves - answer.swaps.length);

  const isMovable = (cell: number) =>
    !locked &&
    remainingMoves > 0 &&
    replay.letters[cell] !== null &&
    replay.letters[cell] !== solution[cell];

  const performSwap = (fromCell: number, toCell: number) => {
    if (locked || remainingMoves <= 0) return;
    const nextLetters = applyWordHashtagSwap(question, replay.letters, { fromCell, toCell });
    if (!nextLetters) {
      setSelectedCell(null);
      setAnnouncement("Ese intercambio no está permitido.");
      return;
    }

    const nextAnswer = { swaps: [...answer.swaps, { fromCell, toCell }] };
    const nextMetrics = calculateWordHashtagMetrics(question, nextAnswer);
    setAnswer(nextAnswer);
    setSelectedCell(null);
    setDragTarget(null);
    onProgress(nextAnswer);
    const nextRemaining = Math.max(0, question.maxMoves - nextAnswer.swaps.length);
    setAnnouncement(
      nextMetrics.solved
        ? "Has completado las cuatro palabras."
        : `Intercambio realizado. ${nextRemaining} ${nextRemaining === 1 ? "movimiento restante" : "movimientos restantes"}. ${nextMetrics.correctCells} de 16 letras correctas.`,
    );
    if (nextMetrics.solved || nextAnswer.swaps.length >= question.maxMoves) {
      onSubmit(nextAnswer);
    }
  };

  const handleClick = (cell: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!isMovable(cell)) return;
    if (selectedCell === null) {
      setSelectedCell(cell);
      setAnnouncement(`Letra ${replay.letters[cell]} seleccionada. Elige otra letra amarilla.`);
      return;
    }
    if (selectedCell === cell) {
      setSelectedCell(null);
      setAnnouncement("Selección cancelada.");
      return;
    }
    performSwap(selectedCell, cell);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, cell: number) => {
    if (!isMovable(cell)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      sourceCell: cell,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
      drag.moved = true;
      setSelectedCell(drag.sourceCell);
    }
    if (!drag.moved) return;
    const target = cellFromPoint(event.clientX, event.clientY);
    setDragTarget(
      target !== null && target !== drag.sourceCell && isMovable(target) ? target : null,
    );
  };

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragTarget(null);
    if (!drag.moved) return;

    suppressClickRef.current = true;
    const target = cancelled ? null : cellFromPoint(event.clientX, event.clientY);
    if (target !== null && target !== drag.sourceCell && isMovable(target)) {
      performSwap(drag.sourceCell, target);
    } else {
      setSelectedCell(null);
      setAnnouncement("Arrastre cancelado; no se ha consumido ningún movimiento.");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    const row = Math.floor(cell / 5);
    const column = cell % 5;
    for (let distance = 1; distance < 5; distance += 1) {
      const nextRow = row + direction[0] * distance;
      const nextColumn = column + direction[1] * distance;
      if (nextRow < 0 || nextRow >= 5 || nextColumn < 0 || nextColumn >= 5) break;
      const nextCell = nextRow * 5 + nextColumn;
      if (!isMovable(nextCell)) continue;
      event.preventDefault();
      cellRefs.current.get(nextCell)?.focus();
      return;
    }
  };

  return (
    <section
      className={`${styles.root} ${className ?? ""}`}
      aria-label="Hashtag de cuatro palabras"
      data-format="word-hashtag"
    >
      <div className={styles.header}>
        <span>Tablero de palabras</span>
        <strong>
          {remainingMoves} {remainingMoves === 1 ? "movimiento restante" : "movimientos restantes"}
        </strong>
      </div>

      <div className={styles.board} role="grid" aria-label="Hashtag de palabras de cinco por cinco">
        {replay.letters.map((letter, cell) => {
          if (letter === null) {
            return <span key={cell} className={styles.empty} aria-hidden="true" />;
          }
          const row = Math.floor(cell / 5) + 1;
          const column = (cell % 5) + 1;
          const correct = letter === solution[cell];
          const selected = selectedCell === cell;
          const target = dragTarget === cell;
          const state = correct
            ? "correct"
            : target
              ? "target"
              : selected
                ? "selected"
                : "displaced";
          return (
            <button
              key={cell}
              ref={(node) => {
                if (node) cellRefs.current.set(cell, node);
                else cellRefs.current.delete(cell);
              }}
              type="button"
              role="gridcell"
              data-word-hashtag-cell={cell}
              data-state={state}
              className={`${styles.tile} ${correct ? styles.correct : styles.displaced} ${selected ? styles.selected : ""} ${target ? styles.dragTarget : ""}`}
              disabled={!isMovable(cell)}
              aria-selected={selected}
              aria-label={`Letra ${letter}, fila ${row}, columna ${column}: ${correct ? "posición correcta y bloqueada" : selected ? "desplazada y seleccionada" : "desplazada"}`}
              onClick={() => handleClick(cell)}
              onKeyDown={(event) => handleKeyDown(event, cell)}
              onPointerDown={(event) => handlePointerDown(event, cell)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishPointer(event)}
              onPointerCancel={(event) => finishPointer(event, true)}
            >
              <b aria-hidden="true">{letter}</b>
              <small aria-hidden="true">{correct ? "✓" : "↔"}</small>
            </button>
          );
        })}
      </div>

      <div className={styles.progress} aria-hidden="true">
        <span>
          <strong>{metrics.correctCells}</strong>/16 letras
        </span>
        <span>
          <strong>{metrics.completedWords}</strong>/4 palabras
        </span>
      </div>
      <p className={styles.instructions}>
        Toca dos fichas amarillas o arrastra una sobre otra. También puedes recorrerlas con las
        flechas y seleccionarlas con Enter o Espacio.
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
