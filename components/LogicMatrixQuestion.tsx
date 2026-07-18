"use client";

import { motion } from "motion/react";
import styles from "@/components/LogicMatrixQuestion.module.css";
import type { LogicMatrixPiece } from "@/types/game";

type LogicMatrixQuestionProps = {
  pieces: LogicMatrixPiece[];
  cells: Array<string | null>;
  optionIds: string[];
  locked: boolean;
  onSubmit: (answer: string) => void;
};

export function LogicMatrixQuestion({
  pieces,
  cells,
  optionIds,
  locked,
  onSubmit,
}: LogicMatrixQuestionProps) {
  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]));

  return (
    <section className={styles.root}>
      <div className={styles.matrix} role="grid" aria-label="Matriz lógica con una casilla vacía">
        {cells.map((pieceId, index) => {
          const piece = pieceId ? piecesById.get(pieceId) : undefined;
          return (
            <div
              key={`${pieceId ?? "empty"}-${index}`}
              className={`${styles.cell} ${piece ? "" : styles.emptyCell}`}
              role="gridcell"
              aria-label={
                piece
                  ? `Fila ${Math.floor(index / 3) + 1}, columna ${(index % 3) + 1}: ${piece.label}`
                  : `Fila ${Math.floor(index / 3) + 1}, columna ${(index % 3) + 1}: casilla vacía`
              }
            >
              {piece ? (
                <>
                  <span aria-hidden="true">{piece.symbol}</span>
                  <small>{piece.label}</small>
                </>
              ) : (
                <span aria-hidden="true">?</span>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.instructions}>Elige la pieza que completa la regla de la matriz.</p>
      <div className={styles.options} role="group" aria-label="Opciones para completar la matriz">
        {optionIds.map((optionId, index) => {
          const piece = piecesById.get(optionId);
          if (!piece) return null;
          return (
            <motion.button
              key={optionId}
              type="button"
              className={styles.option}
              disabled={locked}
              onClick={() => onSubmit(optionId)}
              whileTap={locked ? undefined : { scale: 0.97 }}
              aria-label={`Opción ${index + 1}: ${piece.label}`}
            >
              <span aria-hidden="true">{piece.symbol}</span>
              <strong>{piece.label}</strong>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
