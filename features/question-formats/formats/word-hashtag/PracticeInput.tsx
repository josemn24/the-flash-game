"use client";

import { WordHashtagQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: PracticeInputProps<"word-hashtag">) {
  return (
    <WordHashtagQuestion
      key={question.id}
      question={question}
      initialAnswer={initialAnswer}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
