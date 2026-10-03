"use client";

import { MiniWordleQuestion } from "@/components/questions";
import { isMiniWordleAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"mini-wordle">>) {
  return (
    <MiniWordleQuestion
      correctAnswer={question.correctAnswer}
      additionalGuesses={question.additionalGuesses}
      hint={question.hint}
      wordLength={question.wordLength}
      maxAttempts={question.maxAttempts}
      initialAnswer={
        initialAnswer !== undefined && isMiniWordleAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}
