"use client";

import { MiniSudokuQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: PracticeInputProps<"mini-sudoku">) {
  return (
    <MiniSudokuQuestion
      grid={question.grid}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
