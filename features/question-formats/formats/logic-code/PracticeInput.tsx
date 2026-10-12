"use client";

import { LogicCodeQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  codeAttemptCount = 0,
  onProgress,
  onCodeAttempt,
}: QuestionInputProps<PracticeQuestionOfType<"logic-code">>) {
  return (
    <LogicCodeQuestion
      clues={question.clues}
      codeLength={question.codeLength}
      initialDraft={typeof initialAnswer === "string" ? initialAnswer : undefined}
      locked={locked}
      attemptCount={codeAttemptCount}
      onProgress={onProgress}
      onAttempt={onCodeAttempt}
    />
  );
}
