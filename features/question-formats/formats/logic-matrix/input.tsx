"use client";
import { LogicMatrixQuestion } from "@/components/questions/formats/logic-matrix/LogicMatrixQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "logic-matrix" }
  >;
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
