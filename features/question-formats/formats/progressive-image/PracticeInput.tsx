"use client";

import { ProgressiveImageQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: PracticeInputProps<"progressive-image">) {
  return (
    <ProgressiveImageQuestion
      key={question.id}
      surface={question.surface}
      revealDuration={question.revealDuration}
      answerLabel={question.answerLabel}
      answerPlaceholder={question.answerPlaceholder}
      locked={locked}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}
