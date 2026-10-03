"use client";

import { QueensQuestion } from "@/components/questions";
import { isQueensAnswer } from "@/lib/queens";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"queens">>) {
  return (
    <QueensQuestion
      key={question.id}
      question={question}
      initialAnswer={isQueensAnswer(initialAnswer, question.grid) ? initialAnswer : undefined}
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}
