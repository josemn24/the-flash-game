"use client";

import { MiniSudokuQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"mini-sudoku">>) {
  return (
    <MiniSudokuQuestion
      grid={question.grid}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
