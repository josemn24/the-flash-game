"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useState } from "react";
import styles from "./AnagramQuestion.module.css";
import { RotateIcon, UndoIcon } from "@/components/ui";
import { MotionButton } from "@/components/ui";
import type { AnagramTile } from "@/types/game";

type Props = {
  tiles: AnagramTile[];
  hint?: string;
  locked: boolean;
  onSubmit: (answer: string) => void;
};

export function AnagramQuestion({ tiles, hint, locked, onSubmit }: Props) {
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const chosenTiles = chosenIds.map((id) => tiles.find((tile) => tile.id === id)!);
  const answer = chosenTiles.map((tile) => tile.value).join("");

  const chooseTile = (id: string) => {
    if (!locked) setChosenIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  return (
    <div className={`${styles.root}`}>
      {hint && <p className={styles.hint}>Pista: {hint}</p>}
      <section className={styles.answer} aria-label="Palabra construida">
        <div className={styles.answerHeader}>
          <span>Tu palabra</span>
          <span>
            {chosenIds.length} de {tiles.length} letras
          </span>
        </div>
        <div
          className={styles.answerTiles}
          style={{ "--tile-count": tiles.length } as CSSProperties}
          aria-live="polite"
        >
          {tiles.map((tile, index) => {
            const chosenTile = chosenTiles[index];

            return chosenTile ? (
              <span
                key={`chosen-${chosenTile.id}`}
                className={styles.chosenTile}
                aria-label={`Letra ${index + 1}: ${chosenTile.value}`}
              >
                {chosenTile.value}
              </span>
            ) : (
              <span
                key={`empty-${tile.id}`}
                className={styles.emptySlot}
                aria-label={`Letra ${index + 1} vacía`}
              >
                <span aria-hidden="true">_</span>
              </span>
            );
          })}
        </div>
      </section>

      <section aria-label="Letras disponibles">
        <p className={styles.availableLabel}>Letras disponibles</p>
        <div className={styles.tiles} style={{ "--tile-count": tiles.length } as CSSProperties}>
          {tiles.map((tile) => {
            const isUsed = chosenIds.includes(tile.id);

            return (
              <motion.button
                key={tile.id}
                type="button"
                className={`${styles.tile} ${isUsed ? styles.tileUsed : ""}`}
                disabled={locked || isUsed}
                aria-pressed={isUsed}
                onClick={() => chooseTile(tile.id)}
                aria-label={isUsed ? `Letra ${tile.value} ya usada` : `Añadir letra ${tile.value}`}
                whileTap={locked || isUsed ? undefined : { scale: 0.93 }}
              >
                <span aria-hidden={isUsed ? "true" : undefined}>{isUsed ? "_" : tile.value}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <div className={styles.actions}>
        <div className={styles.secondaryActions}>
          <MotionButton
            className={styles.secondaryAction}
            variant="secondary"
            disabled={locked || chosenIds.length === 0}
            onClick={() => setChosenIds((current) => current.slice(0, -1))}
            whileTap={{ scale: 0.985 }}
          >
            <UndoIcon className={styles.actionIcon} />
            Quitar
          </MotionButton>
          <MotionButton
            className={styles.secondaryAction}
            variant="secondary"
            disabled={locked || chosenIds.length === 0}
            onClick={() => setChosenIds([])}
            whileTap={{ scale: 0.985 }}
          >
            <RotateIcon className={styles.actionIcon} />
            Reiniciar
          </MotionButton>
        </div>
        <MotionButton
          className={styles.submitButton}
          disabled={locked || chosenIds.length !== tiles.length}
          onClick={() => onSubmit(answer)}
          whileTap={{ scale: 0.985 }}
        >
          Enviar palabra
        </MotionButton>
      </div>
    </div>
  );
}
