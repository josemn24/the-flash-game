"use client";

import { MemoryPairsQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"memory-pairs">>) {
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
