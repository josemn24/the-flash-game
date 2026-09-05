"use client";

import { motion } from "motion/react";
import { FormEvent, useMemo, useState } from "react";
import { ArrowIcon } from "@/components/ui";
import type { QuestionVariant } from "@/types/game";
import styles from "./ProgressiveCluesQuestion.module.css";

type ProgressiveCluesQuestionProps = {
  questionId: string;
  clues: string[];
  cluePenalty: number;
  points: number;
  initialAnswer?: string;
  initialRevealedClues?: number;
  locked: boolean;
  onReveal: (revealedClues: number) => void;
  onProgress?: (answer: string) => void;
  onSubmit: (answer: string) => void;
  className?: string;
  variant?: QuestionVariant;
};

export function ProgressiveCluesQuestion({
  questionId,
  clues,
  cluePenalty,
  points,
  initialAnswer,
  initialRevealedClues,
  locked,
  onReveal,
  onProgress,
  onSubmit,
  className,
  variant,
}: ProgressiveCluesQuestionProps) {
  const [revealedClues, setRevealedClues] = useState(() =>
    Math.min(Math.max(1, initialRevealedClues ?? 1), clues.length),
  );
  const [answer, setAnswer] = useState(initialAnswer ?? "");
  const [announcement, setAnnouncement] = useState("");
  const availablePoints = useMemo(
    () => Math.max(0, points - cluePenalty * Math.max(0, revealedClues - 1)),
    [cluePenalty, points, revealedClues],
  );
  const canReveal = revealedClues < clues.length;

  const revealNextClue = () => {
    if (locked || !canReveal) return;
    const nextCount = revealedClues + 1;
    const nextMaximum = Math.max(0, points - cluePenalty * (nextCount - 1));
    setRevealedClues(nextCount);
    setAnnouncement(`Pista ${nextCount} revelada. Máximo disponible: ${nextMaximum} puntos.`);
    onReveal(nextCount);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked) onSubmit(value);
  };

  return (
    <div className={`${styles.challenge} ${className ?? ""}`} data-variant={variant ?? "default"}>
      <div className={styles.scoreRow}>
        <span>
          {revealedClues} de {clues.length} {clues.length === 1 ? "pista" : "pistas"}
        </span>
        <strong>Máximo: {availablePoints} pts</strong>
      </div>

      <ol className={styles.clues} aria-label="Pistas reveladas">
        {clues.slice(0, revealedClues).map((clue, index) => (
          <motion.li
            key={`${index}-${clue}`}
            initial={index === 0 ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p>{clue}</p>
          </motion.li>
        ))}
      </ol>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className={styles.actions}>
        {canReveal ? (
          <motion.button
            type="button"
            className={styles.revealButton}
            disabled={locked}
            onClick={revealNextClue}
            whileTap={{ scale: 0.98 }}
          >
            Revelar otra pista <span>−{cluePenalty} pts</span>
          </motion.button>
        ) : (
          <p className={styles.allRevealed}>Todas las pistas están reveladas.</p>
        )}

        <form className={styles.answerPanel} onSubmit={submit}>
          <label htmlFor={`progressive-answer-${questionId}`}>Escribe tu respuesta</label>
          <div className={styles.answerRow}>
            <input
              id={`progressive-answer-${questionId}`}
              type="text"
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                onProgress?.(event.target.value);
              }}
              placeholder="Tu respuesta…"
              disabled={locked}
              autoComplete="off"
              autoFocus
            />
            <motion.button
              type="submit"
              disabled={locked || !answer.trim()}
              whileTap={{ scale: 0.96 }}
              aria-label="Enviar respuesta"
            >
              <ArrowIcon className="h-6 w-6" />
            </motion.button>
          </div>
          <p>Solo tienes un intento. No importan las mayúsculas, las tildes ni los espacios.</p>
        </form>
      </div>
    </div>
  );
}
