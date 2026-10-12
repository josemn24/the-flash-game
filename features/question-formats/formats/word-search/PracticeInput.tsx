"use client";

import { WordSearchQuestion } from "@/components/questions";
import { isWordSearchAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"word-search">>) {
  return (
    <WordSearchQuestion
      key={question.id}
      question={question}
      initialAnswer={
        initialAnswer !== undefined && isWordSearchAnswer(initialAnswer) ? initialAnswer : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onIncorrectAttempt={onIncorrectAttempt}
      onSubmit={onSubmit}
    />
  );
}
