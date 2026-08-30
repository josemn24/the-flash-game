"use client";

import { motion } from "motion/react";
import styles from "@/components/LogicMatrixQuestion.module.css";
import type { LogicMatrixPiece } from "@/types/game";

type LogicMatrixQuestionProps = {
  pieces: LogicMatrixPiece[];
  cells: Array<string | null>;
  optionIds: string[];
  showPieceLabels?: boolean;
  locked: boolean;
  onSubmit: (answer: string) => void;
  variant?: "flash-pop";
};

type MatrixShape = "circle" | "triangle" | "square";
type MatrixDirection = "up" | "right" | "down" | "left";

function parseMatrixPieceId(pieceId: string) {
  const [shape, direction] = pieceId.split("-");

  if (
    !["circle", "triangle", "square"].includes(shape) ||
    !["up", "right", "down", "left"].includes(direction)
  ) {
    return null;
  }

  return { shape: shape as MatrixShape, direction: direction as MatrixDirection };
}

function MatrixSymbol({ piece }: { piece: LogicMatrixPiece }) {
  const parsed = parseMatrixPieceId(piece.id);

  if (!parsed) {
    return (
      <span aria-hidden="true">{piece.symbol}</span>
    );
  }

  return (
    <svg
      className={styles.symbolGraphic}
      viewBox="0 0 112 56"
      aria-hidden="true"
      focusable="false"
    >
      {parsed.shape === "circle" && <circle cx="24" cy="28" r="13" fill="currentColor" />}
      {parsed.shape === "triangle" && (
        <path d="m24 12 15 29H9l15-29Z" fill="currentColor" />
      )}
      {parsed.shape === "square" && (
        <rect x="11" y="15" width="26" height="26" rx="2" fill="currentColor" />
      )}

      {parsed.direction === "up" && (
        <>
          <path d="M72 44V12" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="m58 26 14-14 14 14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {parsed.direction === "right" && (
        <>
          <path d="M54 28h36" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="m78 16 14 12-14 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {parsed.direction === "down" && (
        <>
          <path d="M72 12v32" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="m58 30 14 14 14-14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {parsed.direction === "left" && (
        <>
          <path d="M90 28H54" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="m66 16-14 12 14 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function LogicMatrixQuestion({
  pieces,
  cells,
  optionIds,
  showPieceLabels = true,
  locked,
  onSubmit,
  variant,
}: LogicMatrixQuestionProps) {
  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]));

  return (
    <section
      className={`${styles.root} ${showPieceLabels ? "" : styles.symbolsOnly} ${variant === "flash-pop" ? styles.pop : ""}`}
    >
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
                  <MatrixSymbol piece={piece} />
                  {showPieceLabels && <small>{piece.label}</small>}
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
              <MatrixSymbol piece={piece} />
              {showPieceLabels && <strong>{piece.label}</strong>}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
