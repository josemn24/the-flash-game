"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import styles from "./MiniSudokuQuestion.module.css";
import type { MiniSudokuAnswer } from "@/types/game";

type MiniSudokuQuestionProps = {
  grid: Array<number | null>;
  locked: boolean;
  onProgress: (answer: MiniSudokuAnswer) => void;
  onSubmit: (answer: MiniSudokuAnswer) => void;
};

export function MiniSudokuQuestion({
  grid,
  locked,
  onProgress,
  onSubmit,
}: MiniSudokuQuestionProps) {
  const blankIndexes = useMemo(
    () => grid.flatMap((value, index) => (value === null ? [index] : [])),
    [grid],
  );
  const [answer, setAnswer] = useState<MiniSudokuAnswer>({});
  const [selectedIndex, setSelectedIndex] = useState<number>(blankIndexes[0] ?? -1);
  const completedCells = blankIndexes.filter((index) => answer[String(index)] !== undefined).length;
  const selectedValue = answer[String(selectedIndex)];

  const updateAnswer = (nextAnswer: MiniSudokuAnswer) => {
    setAnswer(nextAnswer);
    onProgress(nextAnswer);
  };

  const enterValue = (value: number) => {
    if (locked || selectedIndex < 0) return;
    updateAnswer({ ...answer, [selectedIndex]: value });
  };

  const clearValue = () => {
    if (locked || selectedIndex < 0 || selectedValue === undefined) return;
    const nextAnswer = { ...answer };
    delete nextAnswer[String(selectedIndex)];
    updateAnswer(nextAnswer);
  };

  return (
    <section
      className={styles.root}
      aria-label="Mini-sudoku de cuatro por cuatro"
    >
      <div className={styles.grid} role="grid" aria-label="Cuadrícula de mini-sudoku">
        {grid.map((givenValue, index) => {
          const isBlank = givenValue === null;
          const value = isBlank ? answer[String(index)] : givenValue;
          const selected = index === selectedIndex;
          const row = Math.floor(index / 4) + 1;
          const column = (index % 4) + 1;
          const blockClasses = [
            index % 4 === 1 ? styles.blockRight : "",
            Math.floor(index / 4) === 1 ? styles.blockBottom : "",
          ].join(" ");

          if (!isBlank) {
            return (
              <div
                key={index}
                className={`${styles.cell} ${styles.given} ${blockClasses}`}
                role="gridcell"
                aria-label={`Fila ${row}, columna ${column}: pista ${value}`}
              >
                {value}
              </div>
            );
          }

          return (
            <button
              key={index}
              type="button"
              className={`${styles.cell} ${styles.editable} ${selected ? styles.selected : ""} ${blockClasses}`}
              disabled={locked}
              onClick={() => setSelectedIndex(index)}
              aria-label={`Fila ${row}, columna ${column}: ${value ?? "vacía"}`}
              aria-pressed={selected}
            >
              {value ?? ""}
            </button>
          );
        })}
      </div>

      <p className={styles.progress} aria-live="polite">
        {completedCells} de {blankIndexes.length} casillas completadas
      </p>
      <p className={styles.instructions}>
        Selecciona una casilla vacía y usa el teclado numérico para escribir o corregir su valor.
      </p>

      <div className={styles.keypad} role="group" aria-label="Teclado numérico">
        {[1, 2, 3, 4].map((value) => (
          <motion.button
            key={value}
            type="button"
            className={styles.key}
            disabled={locked || selectedIndex < 0}
            onClick={() => enterValue(value)}
            whileTap={locked ? undefined : { scale: 0.95 }}
            aria-label={`Escribir ${value}`}
          >
            {value}
          </motion.button>
        ))}
        <button
          type="button"
          className={styles.clearButton}
          disabled={locked || selectedIndex < 0 || selectedValue === undefined}
          onClick={clearValue}
        >
          Borrar
        </button>
      </div>

      <motion.button
        type="button"
        className={styles.confirmButton}
        disabled={locked || completedCells !== blankIndexes.length}
        onClick={() => onSubmit(answer)}
        whileTap={locked || completedCells !== blankIndexes.length ? undefined : { scale: 0.98 }}
      >
        Confirmar sudoku
      </motion.button>
    </section>
  );
}
