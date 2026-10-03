"use client";

import { WordHashtagQuestion } from "@/components/questions";
import { isWordHashtagAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"word-hashtag">>) {
  return (
    <WordHashtagQuestion
      key={question.id}
      question={question}
      initialAnswer={isWordHashtagAnswer(initialAnswer) ? initialAnswer : undefined}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
