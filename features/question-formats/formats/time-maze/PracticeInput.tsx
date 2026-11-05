"use client";

import { TimeMazeQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: PracticeInputProps<"time-maze">) {
  return (
    <TimeMazeQuestion
      key={question.id}
      question={question}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
