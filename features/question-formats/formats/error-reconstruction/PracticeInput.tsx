"use client";

import { ErrorReconstructionQuestionInput } from "@/components/questions";
import { isErrorReconstructionAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"error-reconstruction">>) {
  return (
    <ErrorReconstructionQuestionInput
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isErrorReconstructionAnswer(initialAnswer)
          ? initialAnswer
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
