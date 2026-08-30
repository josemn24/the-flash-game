"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { MotionButton } from "@/components/ui/MotionButton.client";
import styles from "@/components/OrderingQuestion.module.css";

type OrderingQuestionProps = {
  items: string[];
  initialItems?: string[];
  directionLabels?: {
    start: string;
    end: string;
  };
  locked: boolean;
  onProgress?: (items: string[]) => void;
  onSubmit: (items: string[]) => void;
};

type LastMove = {
  item: string;
  position: number;
  sequence: number;
};

export function OrderingQuestion({
  items,
  initialItems,
  directionLabels = { start: "Menos", end: "Más" },
  locked,
  onProgress,
  onSubmit,
}: OrderingQuestionProps) {
  const [orderedItems, setOrderedItems] = useState(() =>
    initialItems?.length === items.length && initialItems.every((item) => items.includes(item))
      ? [...initialItems]
      : [...items],
  );
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  const moveItem = (index: number, direction: -1 | 1) => {
    if (locked) return;

    const destination = index + direction;
    if (destination < 0 || destination >= orderedItems.length) return;

    const item = orderedItems[index];

    const next = [...orderedItems];
    [next[index], next[destination]] = [next[destination], next[index]];
    setOrderedItems(next);
    onProgress?.(next);
    setLastMove((current) => ({
      item,
      position: destination + 1,
      sequence: (current?.sequence ?? 0) + 1,
    }));
  };

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <div className={styles.directionLabel} aria-hidden="true">
          <span>{directionLabels.start}</span>
          <ArrowUpIcon className={styles.directionIcon} />
        </div>

        <ol className={styles.sequence} aria-label="Orden actual de los elementos">
          {orderedItems.map((item, index) => (
            <motion.li
              layout
              key={item}
              className={styles.card}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {lastMove?.item === item && (
                <motion.span
                  key={lastMove.sequence}
                  className={styles.movePulse}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.985, 1, 1.01] }}
                  transition={{ duration: 0.36, ease: "easeOut" }}
                  aria-hidden="true"
                />
              )}

              <span className={styles.position} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.itemLabel}>{item}</span>
              <span className={styles.controls}>
                <motion.button
                  type="button"
                  className={styles.control}
                  disabled={locked || index === 0}
                  onClick={() => moveItem(index, -1)}
                  whileTap={locked || index === 0 ? undefined : { scale: 0.92 }}
                  aria-label={`Mover ${item} arriba`}
                >
                  <ArrowUpIcon className={styles.controlIcon} />
                </motion.button>
                <motion.button
                  type="button"
                  className={styles.control}
                  disabled={locked || index === orderedItems.length - 1}
                  onClick={() => moveItem(index, 1)}
                  whileTap={
                    locked || index === orderedItems.length - 1 ? undefined : { scale: 0.92 }
                  }
                  aria-label={`Mover ${item} abajo`}
                >
                  <ArrowDownIcon className={styles.controlIcon} />
                </motion.button>
              </span>
            </motion.li>
          ))}
        </ol>

        <div
          className={`${styles.directionLabel} ${styles.directionLabelBottom}`}
          aria-hidden="true"
        >
          <ArrowDownIcon className={styles.directionIcon} />
          <span>{directionLabels.end}</span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {lastMove && `${lastMove.item}, posición ${lastMove.position} de ${orderedItems.length}.`}
      </p>

      <MotionButton
        className={styles.confirmButton}
        disabled={locked}
        onClick={() => onSubmit([...orderedItems])}
        whileTap={{ scale: 0.985 }}
      >
        Confirmar orden
      </MotionButton>
    </div>
  );
}
