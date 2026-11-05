"use client";

import { LogicMatrixQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"logic-matrix">) {
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
