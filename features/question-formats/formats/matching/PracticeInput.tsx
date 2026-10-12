"use client";

import { MatchingQuestion } from "@/components/questions";
import { isMatchingAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"matching">>) {
  return (
    <MatchingQuestion
      leftItems={question.leftItems}
      rightItems={question.rightItems}
      initialAnswer={
        initialAnswer !== undefined && isMatchingAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}
