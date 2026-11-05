"use client";

import { SlidingPuzzleQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: PracticeInputProps<"sliding-puzzle">) {
  return (
    <SlidingPuzzleQuestion
      initialTiles={question.initialTiles}
      solution={question.solution}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}
