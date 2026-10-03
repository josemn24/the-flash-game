"use client";

import { SimonSequenceQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: QuestionInputProps<PracticeQuestionOfType<"simon-sequence">>) {
  return (
    <SimonSequenceQuestion
      pads={question.pads}
      sequence={question.sequence}
      locked={locked}
      onSubmit={onSubmit}
      onTimedResponseStart={onTimedResponseStart}
    />
  );
}
