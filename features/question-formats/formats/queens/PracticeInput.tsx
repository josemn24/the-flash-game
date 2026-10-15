"use client";

import { QueensQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: PracticeInputProps<"queens">) {
  return (
    <QueensQuestion
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
