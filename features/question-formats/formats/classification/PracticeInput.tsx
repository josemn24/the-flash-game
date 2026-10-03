"use client";

import { ClassificationQuestion } from "@/components/questions";
import { isClassificationAnswer } from "@/lib/scoring";
import type { ClassificationAnswer, PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"classification">>) {
  return (
    <ClassificationQuestion
      items={question.items}
      categories={question.categories}
      initialAnswer={
        isClassificationAnswer(initialAnswer ?? null)
          ? (initialAnswer as ClassificationAnswer)
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
