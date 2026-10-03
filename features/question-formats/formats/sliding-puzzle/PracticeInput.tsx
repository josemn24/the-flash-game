"use client";

import { SlidingPuzzleQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"sliding-puzzle">>) {
  return (
    <SlidingPuzzleQuestion
      initialTiles={question.initialTiles}
      solution={question.solution}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}
