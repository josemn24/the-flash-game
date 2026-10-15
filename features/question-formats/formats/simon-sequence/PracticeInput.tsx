"use client";

import { SimonSequenceQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
  onTimedResponseStart,
}: PracticeInputProps<"simon-sequence">) {
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
