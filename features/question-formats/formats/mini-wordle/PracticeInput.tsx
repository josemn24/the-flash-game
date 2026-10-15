"use client";

import { MiniWordleQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: PracticeInputProps<"mini-wordle">) {
  return (
    <MiniWordleQuestion
      correctAnswer={question.correctAnswer}
      additionalGuesses={question.additionalGuesses}
      hint={question.hint}
      wordLength={question.wordLength}
      maxAttempts={question.maxAttempts}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}
