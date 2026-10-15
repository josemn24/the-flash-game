"use client";
import { LogicMatrixQuestion } from "@/components/questions/formats/logic-matrix/LogicMatrixQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"logic-matrix">) {
  const { locked, onSubmit } = props;
  const { question } = props;
  return (
    <>
      <LogicMatrixQuestion
        pieces={[...question.pieces]}
        cells={[...question.cells]}
        optionIds={[...question.optionIds]}
        showPieceLabels={question.showPieceLabels}
        locked={locked}
        onSubmit={onSubmit}
      />
    </>
  );
}
