"use client";

import { LogicCodeQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  codeAttemptCount = 0,
  onProgress,
  onCodeAttempt,
}: PracticeInputProps<"logic-code">) {
  return (
    <LogicCodeQuestion
      clues={question.clues}
      codeLength={question.codeLength}
      initialDraft={initialAnswer}
      locked={locked}
      attemptCount={codeAttemptCount}
      onProgress={onProgress}
      onAttempt={onCodeAttempt}
    />
  );
}
