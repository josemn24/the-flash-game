"use client";

import { ClassificationQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: PracticeInputProps<"classification">) {
  return (
    <ClassificationQuestion
      items={question.items}
      categories={question.categories}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
