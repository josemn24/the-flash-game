"use client";

import { type CSSProperties, type FormEvent, useId, useState } from "react";
import { MotionButton } from "@/components/ui";
import type { ServerMiniWordleProgress } from "@/types/gameplay/challenge";
import { normalizeMiniWordleWord } from "@/lib/miniWordle";
import styles from "./MiniWordleQuestion.module.css";

const STATUS_LABELS = {
  correct: "posición correcta",
  present: "está en otra posición",
  absent: "no está en la palabra",
} as const;

const STATUS_MARKS = { correct: "✓", present: "↔", absent: "×" } as const;

export function ServerMiniWordleQuestion({
  question,
  progress,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetry,
  onSubmit,
}: {
  readonly question: {
    hint: string | null;
    wordLength: 4 | 5;
    maxAttempts: number;
  };
  readonly progress: ServerMiniWordleProgress;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetry?: () => void;
  readonly onSubmit: (guess: string) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const canSubmit = !locked && progress.attemptsUsed < question.maxAttempts;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !value.trim()) return;
    onSubmit(normalizeMiniWordleWord(value));
    setValue("");
  };

  return (
    <div className={styles.root}>
      {question.hint ? <p className={styles.hint}>Pista: {question.hint}</p> : null}
      <section
        className={styles.board}
        style={{ "--mini-wordle-columns": question.wordLength } as CSSProperties}
        aria-label="Intentos de Mini-Wordle"
      >
        {Array.from({ length: question.maxAttempts }, (_, rowIndex) => {
          const guess = progress.guesses[rowIndex];
          const feedback = progress.feedback[rowIndex];
          return (
            <div
              key={rowIndex}
              className={styles.row}
              aria-label={`Intento ${rowIndex + 1}${guess ? `: ${guess}` : ", vacío"}`}
            >
              {Array.from({ length: question.wordLength }, (_, columnIndex) => {
                const item = feedback?.[columnIndex];
                return (
                  <span
                    key={columnIndex}
                    className={`${styles.tile} ${item ? styles[item.status] : styles.empty}`}
                    data-state={item?.status ?? "empty"}
                    aria-label={
                      item
                        ? `${item.letter}: ${STATUS_LABELS[item.status]}`
                        : `Letra ${columnIndex + 1}, vacía`
                    }
                  >
                    <b>{item?.letter ?? guess?.[columnIndex] ?? ""}</b>
                    {item ? <small aria-hidden="true">{STATUS_MARKS[item.status]}</small> : null}
                  </span>
                );
              })}
            </div>
          );
        })}
      </section>
      <form className={styles.form} onSubmit={submit}>
        <label htmlFor={inputId}>Escribe tu intento</label>
        <div className={styles.inputRow}>
          <input
            id={inputId}
            type="text"
            value={value}
            maxLength={question.wordLength}
            disabled={!canSubmit}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => setValue(event.target.value.toLocaleUpperCase("es-ES"))}
          />
          <MotionButton type="submit" disabled={!canSubmit || !value.trim()}>
            Enviar
          </MotionButton>
        </div>
        <div className={styles.formMeta}>
          <span>Intento {Math.min(progress.attemptsUsed + 1, question.maxAttempts)} de {question.maxAttempts}</span>
          <span className={styles.error} role="status" aria-live="polite">
            {submissionState === "submitting" && submissionStatusVisible
              ? "Comprobando palabra…"
              : submissionError ?? ""}
          </span>
        </div>
        {submissionState === "error" && onRetry ? (
          <MotionButton type="button" variant="secondary" onClick={onRetry}>
            Reintentar
          </MotionButton>
        ) : null}
      </form>
    </div>
  );
}
