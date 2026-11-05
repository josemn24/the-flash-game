"use client";

import { OrderingQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: PracticeInputProps<"ordering">) {
  return (
    <OrderingQuestion
      items={question.items}
      directionLabels={question.directionLabels}
      initialItems={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
