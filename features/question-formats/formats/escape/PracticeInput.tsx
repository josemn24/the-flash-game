"use client";

import { EscapeQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: PracticeInputProps<"escape">) {
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
