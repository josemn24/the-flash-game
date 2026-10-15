"use client";

import { useEffect, useRef, useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import type { ServerMiniWordleProgress } from "@/types/gameplay/challenge";
import { normalizeMiniWordleWord } from "@/lib/miniWordle";
import { MiniWordleView } from "./MiniWordleView";
import styles from "./MiniWordleQuestion.module.css";

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

  const submit = () => {
    if (!canSubmit || !value.trim()) return;
    onSubmit(normalizeMiniWordleWord(value));
    setValue("");
  };

  return (
    <MiniWordleView
      rows={progress.guesses.map((guess, index) => ({ guess, feedback: progress.feedback[index] }))}
      wordLength={question.wordLength}
      maxAttempts={question.maxAttempts}
      attemptsUsed={progress.attemptsUsed}
      hint={question.hint}
      value={value}
      disabled={!canSubmit}
      onValueChange={(next) => setValue(next.toLocaleUpperCase("es-ES"))}
      onSubmit={submit}
      inputRef={inputRef}
      metaMessage={
        submissionState === "idle" && submissionError ? (
          <span className={styles.error} role="status" aria-live="polite">
            {submissionError}
          </span>
        ) : null
      }
      afterMeta={
        <ServerOperationStatus
          state={submissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando palabra…"
          errorMessage={submissionError ?? "No hemos podido confirmar tu palabra."}
          retryLabel="Reintentar"
          onRetry={onRetry}
        />
      }
    />
  );
}
