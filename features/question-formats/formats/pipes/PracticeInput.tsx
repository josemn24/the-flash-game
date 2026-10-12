"use client";

import { PipesQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"pipes">>) {
  return (
    <PipesQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
