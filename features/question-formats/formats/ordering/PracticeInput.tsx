"use client";

import { OrderingQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"ordering">>) {
  return (
    <OrderingQuestion
      items={question.items}
      directionLabels={question.directionLabels}
      initialItems={
        Array.isArray(initialAnswer) && initialAnswer.every((item) => typeof item === "string")
          ? initialAnswer
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
