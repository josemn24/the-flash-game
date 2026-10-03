"use client";

import { MiniNonogramQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"mini-nonogram">>) {
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
