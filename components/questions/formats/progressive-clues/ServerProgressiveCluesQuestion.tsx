"use client";

import { motion } from "motion/react";
import { type FormEvent, useId, useState } from "react";
import { ArrowIcon } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
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

  const answerStatus =
    submissionState === "idle"
      ? "Solo tienes un intento. No importan mayúsculas, tildes ni espacios."
      : "";

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
        <ServerOperationStatus
          state={revealState}
          visible={revealStatusVisible}
          pendingMessage="Solicitando otra pista…"
          errorMessage={revealError ?? "No hemos podido revelar la siguiente pista."}
          retryLabel="Reintentar revelación"
          onRetry={onRetryReveal}
        />
        {revealState === "idle" && revealError ? (
          <p className="sr-only" role="status" aria-live="polite">
            {revealError}
          </p>
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
          <p>{answerStatus}</p>
          <ServerOperationStatus
            state={submissionState}
            visible={submissionStatusVisible}
            pendingMessage="Comprobando respuesta…"
            errorMessage={submissionError ?? "No hemos podido confirmar tu respuesta."}
            retryLabel="Reintentar respuesta"
            onRetry={onRetry}
          />
        </form>
      </div>
    </div>
  );
}
