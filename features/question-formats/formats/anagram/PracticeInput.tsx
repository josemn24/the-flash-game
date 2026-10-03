"use client";

import { AnagramQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"anagram">>) {
  return (
    <AnagramQuestion
      tiles={question.tiles}
      hint={question.hint}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}
