"use client";

import { MiniNonogramQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: PracticeInputProps<"mini-nonogram">) {
  return (
    <MiniNonogramQuestion
      rowClues={question.rowClues}
      columnClues={question.columnClues}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
