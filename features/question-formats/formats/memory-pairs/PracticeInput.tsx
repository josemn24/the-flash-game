"use client";

import { MemoryPairsQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: PracticeInputProps<"memory-pairs">) {
  return (
    <MemoryPairsQuestion
      grid={question.grid}
      tiles={question.tiles}
      mismatchRevealDuration={question.mismatchRevealDuration}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
