"use client";

import { MatchingQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: PracticeInputProps<"matching">) {
  return (
    <MatchingQuestion
      leftItems={question.leftItems}
      rightItems={question.rightItems}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}
