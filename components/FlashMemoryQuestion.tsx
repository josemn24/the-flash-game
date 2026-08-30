"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionMedia } from "@/components/QuestionMedia";
import { MotionButton } from "@/components/ui/MotionButton.client";
import styles from "@/components/FlashMemoryQuestion.module.css";
import type { FlashMemoryAnswer, FlashMemoryItem } from "@/types/game";

type FlashMemoryQuestionProps = {
  items: FlashMemoryItem[];
  grid: { rows: number; columns: number };
  revealDuration: number;
  locked: boolean;
  onProgress: (answer: FlashMemoryAnswer) => void;
  onSubmit: (answer: FlashMemoryAnswer) => void;
  onTimedResponseStart: () => void;
};

function MemoryTile({ item }: { item: FlashMemoryItem }) {
  return (
    <span className={styles.tileContent}>
      {item.media && <QuestionMedia media={item.media} />}
      <strong>{item.label}</strong>
    </span>
  );
}

export function FlashMemoryQuestion({
  items,
  grid,
  revealDuration,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: FlashMemoryQuestionProps) {
  const [phase, setPhase] = useState<"memorize" | "recall">("memorize");
  const [remaining, setRemaining] = useState(revealDuration);
  const [answer, setAnswer] = useState<FlashMemoryAnswer>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const positions = useMemo(
    () => Array.from({ length: grid.rows * grid.columns }, (_, index) => index),
    [grid.columns, grid.rows],
  );

  useEffect(() => {
    if (phase !== "memorize") return;
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setRemaining(Math.max(0, revealDuration - elapsed));
    }, 100);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setRemaining(0);
      setPhase("recall");
      onTimedResponseStart();
    }, revealDuration * 1000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onTimedResponseStart, phase, revealDuration]);

  const updateAnswer = (next: FlashMemoryAnswer) => {
    setAnswer(next);
    onProgress(next);
  };

  const chooseItem = (itemId: string) => {
    if (locked) return;
    setSelectedItemId((current) => (current === itemId ? null : itemId));
  };

  const choosePosition = (position: number) => {
    if (locked) return;
    const key = String(position);
    const occupyingItemId = answer[key];
    if (occupyingItemId) {
      const next = { ...answer };
      delete next[key];
      updateAnswer(next);
      setSelectedItemId(occupyingItemId);
      return;
    }
    if (!selectedItemId) return;

    const next = { ...answer };
    for (const [currentPosition, itemId] of Object.entries(next)) {
      if (itemId === selectedItemId) delete next[currentPosition];
    }
    next[key] = selectedItemId;
    updateAnswer(next);
    setSelectedItemId(null);
  };

  const placedCount = Object.keys(answer).length;
  const complete = placedCount === positions.length;
  const itemById = new Map(items.map((item) => [item.id, item]));

  if (phase === "memorize") {
    return (
      <section className={styles.root} aria-live="polite">
        <div className={styles.phaseHeader}>
          <span>Memoriza la composición</span>
          <strong>{Math.ceil(remaining)} s</strong>
        </div>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}
          aria-label="Composición para memorizar"
        >
          {positions.map((position) => {
            const item = items.find((candidate) => candidate.correctPosition === position);
            return (
              <div key={position} className={styles.memoryCell}>
                {item && <MemoryTile item={item} />}
              </div>
            );
          })}
        </div>
        <p className={styles.helper}>Las fichas se ocultarán automáticamente.</p>
      </section>
    );
  }

  return (
    <section className={styles.root} aria-live="polite">
      <div className={styles.phaseHeader}>
        <span>Reconstruye la composición</span>
        <strong>
          {placedCount} de {positions.length}
        </strong>
      </div>
      <p className={styles.instructions}>
        Elige una ficha y después una posición. Toca una ficha colocada para recuperarla.
      </p>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}
        aria-label="Cuadrícula para reconstruir"
      >
        {positions.map((position) => {
          const item = itemById.get(answer[String(position)]);
          return (
            <button
              key={position}
              type="button"
              className={`${styles.recallCell} ${item ? styles.recallCellFilled : ""}`}
              disabled={locked}
              onClick={() => choosePosition(position)}
              aria-label={
                item
                  ? `Posición ${position + 1}: ${item.label}. Toca para retirarla.`
                  : `Posición ${position + 1}: vacía`
              }
            >
              {item ? (
                <MemoryTile item={item} />
              ) : (
                <span className={styles.emptyCell}>Posición {position + 1}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.bank} role="group" aria-label="Fichas para colocar">
        {items.map((item) => {
          const selected = item.id === selectedItemId;
          const placed = Object.values(answer).includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.bankItem} ${selected ? styles.bankItemSelected : ""} ${placed ? styles.bankItemPlaced : ""}`}
              disabled={locked}
              aria-pressed={selected}
              onClick={() => chooseItem(item.id)}
            >
              <MemoryTile item={item} />
            </button>
          );
        })}
      </div>
      <MotionButton
        disabled={locked || !complete}
        onClick={() => onSubmit({ ...answer })}
        whileTap={{ scale: 0.985 }}
      >
        Confirmar posiciones
      </MotionButton>
    </section>
  );
}
