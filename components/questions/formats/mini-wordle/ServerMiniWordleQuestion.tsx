"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { MotionButton } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const previousAttemptsUsedRef = useRef(progress.attemptsUsed);
  const focusAfterAcceptedGuessRef = useRef(false);
  const [value, setValue] = useState("");
  const canSubmit = !locked && progress.attemptsUsed < question.maxAttempts;

  useEffect(() => {
    const previousAttemptsUsed = previousAttemptsUsedRef.current;
    previousAttemptsUsedRef.current = progress.attemptsUsed;
    if (progress.attemptsUsed > previousAttemptsUsed) focusAfterAcceptedGuessRef.current = true;
    if (
      focusAfterAcceptedGuessRef.current &&
      progress.attemptsUsed < question.maxAttempts &&
      !locked
    ) {
      inputRef.current?.focus();
      focusAfterAcceptedGuessRef.current = false;
    }
  }, [locked, progress.attemptsUsed, question.maxAttempts]);

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
            ref={inputRef}
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
          <span>
            Intento {Math.min(progress.attemptsUsed + 1, question.maxAttempts)} de{" "}
            {question.maxAttempts}
          </span>
          {submissionState === "idle" && submissionError ? (
            <span className={styles.error} role="status" aria-live="polite">
              {submissionError}
            </span>
          ) : null}
        </div>
        <ServerOperationStatus
          state={submissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando palabra…"
          errorMessage={submissionError ?? "No hemos podido confirmar tu palabra."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      </form>
    </div>
  );
}
