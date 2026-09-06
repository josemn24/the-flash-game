"use client";

import { motion } from "motion/react";
import { useState } from "react";
import styles from "./MiniNonogramQuestion.module.css";
import type { MiniNonogramAnswer } from "@/types/game";

type MiniNonogramQuestionProps = {
  rowClues: number[][];
  columnClues: number[][];
  locked: boolean;
  onProgress: (answer: MiniNonogramAnswer) => void;
  onSubmit: (answer: MiniNonogramAnswer) => void;
};

export function MiniNonogramQuestion({
  rowClues,
  columnClues,
  locked,
  onProgress,
  onSubmit,
}: MiniNonogramQuestionProps) {
  const [answer, setAnswer] = useState<MiniNonogramAnswer>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedFilled = answer[String(selectedIndex)] === true;
  const filledCount = Object.keys(answer).length;

  const updateAnswer = (nextAnswer: MiniNonogramAnswer) => {
    setAnswer(nextAnswer);
    onProgress(nextAnswer);
  };

  const fillSelected = () => {
    if (locked) return;
    updateAnswer({ ...answer, [selectedIndex]: true });
  };

  const clearSelected = () => {
    if (locked || !selectedFilled) return;
    const nextAnswer = { ...answer };
    delete nextAnswer[String(selectedIndex)];
    updateAnswer(nextAnswer);
  };

  return (
    <section
      className={styles.root}
      aria-label="Mini-nonograma de cinco por cinco"
    >
      <div className={styles.board}>
        <div className={styles.corner} aria-hidden="true" />
        <div className={styles.columnClues} aria-label="Pistas de columnas">
          {columnClues.map((clues, index) => (
            <div
              key={index}
              className={styles.clue}
              aria-label={`Columna ${index + 1}: ${clues.join(", ") || "ninguna"}`}
            >
              {clues.map((clue, clueIndex) => (
                <span key={clueIndex}>{clue}</span>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.rowClues} aria-label="Pistas de filas">
          {rowClues.map((clues, index) => (
            <div
              key={index}
              className={styles.rowClue}
              aria-label={`Fila ${index + 1}: ${clues.join(", ") || "ninguna"}`}
            >
              {clues.map((clue, clueIndex) => (
                <span key={clueIndex}>{clue}</span>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.grid} role="grid" aria-label="Cuadrícula del mini-nonograma">
          {Array.from({ length: 25 }, (_, index) => {
            const row = Math.floor(index / 5) + 1;
            const column = (index % 5) + 1;
            const filled = answer[String(index)] === true;
            const selected = selectedIndex === index;
            return (
              <button
                key={index}
                type="button"
                className={`${styles.cell} ${filled ? styles.filled : ""} ${selected ? styles.selected : ""}`}
                disabled={locked}
                onClick={() => setSelectedIndex(index)}
                aria-label={`Fila ${row}, columna ${column}: ${filled ? "rellena" : "vacía"}`}
                aria-pressed={selected}
              >
                <span aria-hidden="true">{filled ? "●" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className={styles.progress} aria-live="polite">
        {filledCount} celdas rellenadas
      </p>
      <p className={styles.instructions}>
        Selecciona una celda y marca si debe estar rellena o vacía. Puedes corregirla antes de
        confirmar.
      </p>
      <div
        className={styles.controls}
        role="group"
        aria-label="Acciones para la celda seleccionada"
      >
        <motion.button
          type="button"
          className={styles.fillButton}
          disabled={locked}
          onClick={fillSelected}
          whileTap={locked ? undefined : { scale: 0.97 }}
        >
          Rellenar celda
        </motion.button>
        <button
          type="button"
          className={styles.clearButton}
          disabled={locked || !selectedFilled}
          onClick={clearSelected}
        >
          Marcar vacía
        </button>
      </div>
      <motion.button
        type="button"
        className={styles.confirmButton}
        disabled={locked}
        onClick={() => onSubmit(answer)}
        whileTap={locked ? undefined : { scale: 0.98 }}
      >
        Confirmar nonograma
      </motion.button>
    </section>
  );
}
