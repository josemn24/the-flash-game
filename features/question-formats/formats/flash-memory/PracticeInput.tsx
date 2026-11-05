"use client";

import { FlashMemoryQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: PracticeInputProps<"flash-memory">) {
  return (
    <FlashMemoryQuestion
      items={question.items}
      grid={question.grid}
      revealDuration={question.revealDuration}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}
