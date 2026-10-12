"use client";

import { LogicMatrixQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"logic-matrix">>) {
  return (
    <LogicMatrixQuestion
      pieces={question.pieces}
      cells={question.cells}
      optionIds={question.optionIds}
      showPieceLabels={question.showPieceLabels}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}
