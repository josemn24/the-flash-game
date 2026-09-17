"use client";

import { motion } from "motion/react";
import { type FormEvent, useId, useState } from "react";
import { ArrowIcon } from "@/components/ui";
import type { ServerProgressiveCluesProgress } from "@/types/gameplay/challenge";
import styles from "./ProgressiveCluesQuestion.module.css";

export function ServerProgressiveCluesQuestion({
  progress,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetry,
  revealState,
  revealStatusVisible,
  revealError,
  onReveal,
  onRetryReveal,
  onSubmit,
}: {
  readonly progress: ServerProgressiveCluesProgress;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetry?: () => void;
  readonly revealState: "idle" | "submitting" | "error";
  readonly revealStatusVisible: boolean;
  readonly revealError?: string;
  readonly onReveal: () => void;
  readonly onRetryReveal?: () => void;
  readonly onSubmit: (answer: string) => void;
}) {
  const inputId = useId();
  const [answer, setAnswer] = useState("");
  const canReveal =
    !locked && revealState !== "submitting" && progress.revealedClues < progress.totalClues;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked) onSubmit(value);
  };

  const revealStatus =
    revealState === "submitting" && revealStatusVisible
      ? "Solicitando otra pista…"
      : (revealError ?? "");
  const answerStatus =
    submissionState === "submitting" && submissionStatusVisible
      ? "Comprobando respuesta…"
      : (submissionError ?? "");

  return (
    <div className={styles.challenge}>
      <div className={styles.scoreRow}>
        <span>
          {progress.revealedClues} de {progress.totalClues}{" "}
          {progress.totalClues === 1 ? "pista" : "pistas"}
        </span>
        <strong>Máximo: {progress.availablePoints} pts</strong>
      </div>

      <ol className={styles.clues} aria-label="Pistas reveladas">
        {progress.clues.map((clue, index) => (
          <li key={`${index}-${clue}`}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p>{clue}</p>
          </li>
        ))}
      </ol>

      <p className="sr-only" role="status" aria-live="polite">
        {revealStatus}
      </p>

      <div className={styles.actions}>
        {progress.revealedClues < progress.totalClues ? (
          <motion.button
            type="button"
            className={styles.revealButton}
            disabled={!canReveal}
            onClick={onReveal}
            whileTap={{ scale: 0.98 }}
          >
            {revealState === "submitting" ? "Revelando…" : "Revelar otra pista"}
            <span>−{progress.cluePenalty} pts</span>
          </motion.button>
        ) : (
          <p className={styles.allRevealed}>Todas las pistas están reveladas.</p>
        )}
        {revealState === "error" && onRetryReveal ? (
          <button type="button" className="text-sm underline" onClick={onRetryReveal}>
            Reintentar revelación
          </button>
        ) : null}

        <form className={styles.answerPanel} onSubmit={submit}>
          <label htmlFor={inputId}>Escribe tu respuesta</label>
          <div className={styles.answerRow}>
            <input
              id={inputId}
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
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
          <p>
            {answerStatus || "Solo tienes un intento. No importan mayúsculas, tildes ni espacios."}
          </p>
          {submissionState === "error" && onRetry ? (
            <button type="button" className="text-sm underline" onClick={onRetry}>
              Reintentar respuesta
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
