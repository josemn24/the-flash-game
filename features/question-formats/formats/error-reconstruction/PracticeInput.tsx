"use client";

import { ErrorReconstructionQuestionInput } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: PracticeInputProps<"error-reconstruction">) {
  return (
    <ErrorReconstructionQuestionInput
      question={question}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
