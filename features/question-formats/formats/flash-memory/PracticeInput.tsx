"use client";

import { FlashMemoryQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"flash-memory">>) {
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
