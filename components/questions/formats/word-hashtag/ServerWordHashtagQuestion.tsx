"use client";

import { useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import { WORD_HASHTAG_ACTIVE_CELLS } from "@/lib/wordHashtag";
import type { ServerWordHashtagQuestion as ServerQuestion } from "@/types/gameplay/challenge";
import styles from "./WordHashtagQuestion.module.css";

export function ServerWordHashtagQuestion({
  question,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetry,
  onSwap,
}: {
  readonly question: ServerQuestion;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetry?: () => void;
  readonly onSwap: (fromCell: number, toCell: number) => void;
}) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const letters = question.progress.letters;
  const remainingMoves = question.progress.movesRemaining;

  const selectCell = (cell: number) => {
    if (locked || remainingMoves <= 0 || letters[cell] === null) return;
    if (selectedCell === null) {
      setSelectedCell(cell);
      return;
    }
    if (selectedCell === cell) {
      setSelectedCell(null);
      return;
    }
    const fromCell = selectedCell;
    setSelectedCell(null);
    onSwap(fromCell, cell);
  };

  const statusVisible =
    submissionState === "error" || (submissionState === "submitting" && submissionStatusVisible);

  return (
    <section className={styles.root} aria-label="Hashtag de cuatro palabras" data-format="word-hashtag">
      <div className={styles.header}>
        <span>Tablero de palabras</span>
        <strong>
          {remainingMoves} {remainingMoves === 1 ? "movimiento restante" : "movimientos restantes"}
        </strong>
      </div>
      <div className={styles.board} role="grid" aria-label="Hashtag de palabras de cinco por cinco">
        {question.progress.letters.map((letter, cell) => {
          const active = WORD_HASHTAG_ACTIVE_CELLS.includes(cell);
          if (!active || letter === null) {
            return <span key={cell} className={styles.empty} aria-hidden="true" />;
          }
          const selected = selectedCell === cell;
          const row = Math.floor(cell / 5) + 1;
          const column = (cell % 5) + 1;
          return (
            <button
              key={cell}
              type="button"
              role="gridcell"
              data-word-hashtag-cell={cell}
              data-state={selected ? "selected" : "displaced"}
              className={`${styles.tile} ${styles.displaced} ${selected ? styles.selected : ""}`}
              disabled={locked || remainingMoves <= 0}
              aria-selected={selected}
              aria-label={`Letra ${letter}, fila ${row}, columna ${column}${selected ? ", seleccionada" : ""}`}
              onClick={() => selectCell(cell)}
            >
              <b aria-hidden="true">{letter}</b>
              <small aria-hidden="true">{selected ? "✓" : "↔"}</small>
            </button>
          );
        })}
      </div>
      <div className={styles.progress} aria-hidden="true">
        <span>
          <strong>{question.progress.movesUsed}</strong> movimientos usados
        </span>
      </div>
      <p className={styles.instructions}>Selecciona dos fichas para solicitar un intercambio al servidor.</p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {selectedCell === null ? "Selecciona una letra." : "Letra seleccionada. Elige otra letra."}
      </p>
      {statusVisible ? (
        <ServerOperationStatus
          state={submissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando intercambio…"
          errorMessage={submissionError ?? "No hemos podido guardar el intercambio."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      ) : null}
    </section>
  );
}
