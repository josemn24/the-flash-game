"use client";

import { ConnectPairsQuestion } from "@/components/questions";
import { isConnectPairsAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"connect-pairs">>) {
  return (
    <ConnectPairsQuestion
      key={question.id}
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isConnectPairsAnswer(initialAnswer)
          ? initialAnswer
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
