"use client";

import { ConnectPairsQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: PracticeInputProps<"connect-pairs">) {
  return (
    <ConnectPairsQuestion
      key={question.id}
      question={question}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
