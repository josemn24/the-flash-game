"use client";

import { WordSearchQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: PracticeInputProps<"word-search">) {
  return (
    <WordSearchQuestion
      key={question.id}
      question={question}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}
