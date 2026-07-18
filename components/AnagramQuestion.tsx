"use client";

import { motion } from "motion/react";
import { useState } from "react";
import styles from "@/components/AnagramQuestion.module.css";
import { MotionButton } from "@/components/ui/MotionButton.client";
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
  const availableTiles = tiles.filter((tile) => !chosenIds.includes(tile.id));
  const answer = chosenTiles.map((tile) => tile.value).join("");

  const chooseTile = (id: string) => {
    if (!locked) setChosenIds((current) => [...current, id]);
  };

  return (
    <div className={styles.root}>
      {hint && <p className={styles.hint}>Pista: {hint}</p>}
      <section className={styles.answer} aria-label="Palabra construida">
        <div className={styles.answerHeader}>
          <span>Tu palabra</span>
          <span>
            {chosenIds.length} de {tiles.length} letras
          </span>
        </div>
        <div className={styles.answerTiles} aria-live="polite">
          {chosenTiles.length ? (
            chosenTiles.map((tile, index) => (
              <span
                key={tile.id}
                className={styles.chosenTile}
                aria-label={`Letra ${index + 1}: ${tile.value}`}
              >
                {tile.value}
              </span>
            ))
          ) : (
            <span className={styles.placeholder}>Selecciona las letras en orden</span>
          )}
        </div>
      </section>

      <section aria-label="Letras disponibles">
        <p className={styles.availableLabel}>Letras disponibles</p>
        <div className={styles.tiles}>
          {availableTiles.map((tile) => (
            <motion.button
              key={tile.id}
              type="button"
              className={styles.tile}
              disabled={locked}
              onClick={() => chooseTile(tile.id)}
              aria-label={`Añadir letra ${tile.value}`}
              whileTap={locked ? undefined : { scale: 0.93 }}
            >
              {tile.value}
            </motion.button>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <MotionButton
          variant="secondary"
          disabled={locked || chosenIds.length === 0}
          onClick={() => setChosenIds((current) => current.slice(0, -1))}
          whileTap={{ scale: 0.985 }}
        >
          Quitar última
        </MotionButton>
        <MotionButton
          variant="secondary"
          disabled={locked || chosenIds.length === 0}
          onClick={() => setChosenIds([])}
          whileTap={{ scale: 0.985 }}
        >
          Reiniciar
        </MotionButton>
        <MotionButton
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
