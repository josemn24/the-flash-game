"use client";

import { EscapeQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"escape">>) {
  return (
    <EscapeQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
