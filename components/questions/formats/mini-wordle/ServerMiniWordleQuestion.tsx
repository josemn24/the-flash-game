"use client";

import { useEffect, useRef, useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import type { ServerMiniWordleProgress } from "@/types/gameplay/challenge";
import { normalizeMiniWordleDraft, normalizeMiniWordleWord } from "@/lib/miniWordle";
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
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState("");
  const [dismissedError, setDismissedError] = useState<string>();
  const lastFeedback = progress.feedback.at(-1);
  const solved =
    lastFeedback?.length === question.wordLength &&
    lastFeedback.every((letter) => letter.status === "correct");
  const [observed, setObserved] = useState({
    attemptsUsed: progress.attemptsUsed,
    locked,
    submissionState,
    submissionError,
  });
  if (
    observed.attemptsUsed !== progress.attemptsUsed ||
    observed.locked !== locked ||
    observed.submissionState !== submissionState ||
    observed.submissionError !== submissionError
  ) {
    setObserved({ attemptsUsed: progress.attemptsUsed, locked, submissionState, submissionError });
    if (progress.attemptsUsed > observed.attemptsUsed) setValue("");
    if (!locked && submissionState === "idle") setPending(false);
  }
  const canSubmit =
    !locked &&
    !pending &&
    !solved &&
    submissionState === "idle" &&
    progress.attemptsUsed < question.maxAttempts;

  useEffect(() => {
    if (!locked && submissionState === "idle") {
      pendingRef.current = false;
    }
  }, [locked, submissionState, submissionError, progress.attemptsUsed]);

  const submit = () => {
    if (!canSubmit || pendingRef.current || value.length !== question.wordLength) return;
    pendingRef.current = true;
    setPending(true);
    setDismissedError(undefined);
    onSubmit(normalizeMiniWordleWord(value));
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
      busy={pending || submissionState === "submitting"}
      onValueChange={(next) => {
        if (!canSubmit) return;
        setValue(normalizeMiniWordleDraft(next, question.wordLength));
        setDismissedError(submissionError);
      }}
      onSubmit={submit}
      metaMessage={
        submissionState === "idle" && submissionError && submissionError !== dismissedError ? (
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
