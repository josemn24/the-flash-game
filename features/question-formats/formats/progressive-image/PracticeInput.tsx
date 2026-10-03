"use client";

import { ProgressiveImageQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"progressive-image">>) {
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
