"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import styles from "./SlidingPuzzleQuestion.module.css";
import type { SlidingPuzzleAnswer } from "@/types/game";

type SlidingPuzzleQuestionProps = {
  initialTiles: Array<number | null>;
  solution: Array<number | null>;
  locked: boolean;
  onSubmit: (answer: SlidingPuzzleAnswer) => void;
};

function areAdjacent(firstIndex: number, secondIndex: number) {
  return (
    (Math.abs(firstIndex - secondIndex) === 1 &&
      Math.floor(firstIndex / 3) === Math.floor(secondIndex / 3)) ||
    Math.abs(firstIndex - secondIndex) === 3
  );
}

export function SlidingPuzzleQuestion({
  initialTiles,
  solution,
  locked,
  onSubmit,
}: SlidingPuzzleQuestionProps) {
  const [tiles, setTiles] = useState(initialTiles);
  const [moves, setMoves] = useState(0);
  const blankIndex = tiles.indexOf(null);

  const moveTile = (tileIndex: number) => {
    if (locked || !areAdjacent(tileIndex, blankIndex)) return;
    const nextTiles = [...tiles];
    [nextTiles[blankIndex], nextTiles[tileIndex]] = [nextTiles[tileIndex], nextTiles[blankIndex]];
    const nextMoves = moves + 1;
    setTiles(nextTiles);
    setMoves(nextMoves);
    if (nextTiles.every((tile, index) => tile === solution[index])) {
      onSubmit({ tiles: nextTiles, moves: nextMoves });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keyToTileOffset: Record<string, number> = {
      ArrowUp: 3,
      ArrowDown: -3,
      ArrowLeft: 1,
      ArrowRight: -1,
    };
    const offset = keyToTileOffset[event.key];
    if (offset === undefined) return;
    const tileIndex = blankIndex + offset;
    if (tileIndex < 0 || tileIndex >= 9 || !areAdjacent(tileIndex, blankIndex)) return;
    event.preventDefault();
    moveTile(tileIndex);
  };

  return (
    <section className={styles.root} aria-label="Rompecabezas deslizante de tres por tres">
      <p className={styles.instructions}>
        Desliza las fichas junto al hueco hasta ordenarlas del 1 al 8. También puedes usar las
        flechas.
      </p>
      <div
        className={styles.grid}
        role="grid"
        aria-label="Tablero del rompecabezas deslizante"
        onKeyDown={handleKeyDown}
      >
        {tiles.map((tile, index) => {
          const movable = tile !== null && areAdjacent(index, blankIndex);
          const row = Math.floor(index / 3) + 1;
          const column = (index % 3) + 1;
          if (tile === null) {
            return (
              <div
                key="blank"
                className={styles.blank}
                role="gridcell"
                aria-label={`Fila ${row}, columna ${column}: hueco`}
              />
            );
          }
          return (
            <motion.button
              key={tile}
              type="button"
              className={`${styles.tile} ${movable ? styles.movable : styles.lockedTile}`}
              disabled={locked || !movable}
              onClick={() => moveTile(index)}
              whileTap={locked || !movable ? undefined : { scale: 0.94 }}
              aria-label={`Ficha ${tile}, fila ${row}, columna ${column}${movable ? ", se puede deslizar" : ""}`}
            >
              {tile}
            </motion.button>
          );
        })}
      </div>
      <p className={styles.moves} aria-live="polite">
        {moves} movimientos
      </p>
    </section>
  );
}
