"use client";
import { QueensSessionQuestion } from "@/components/questions/formats/queens/QueensSessionQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"queens">) {
  const {
    locked,
    draftQueens,
    queensState,
    queensStatusVisible,
    queensError,
    onQueensDraft,
    onQueensValidate,
    onRetryQueensValidation,
  } = props;
  const { question } = props;
  return (
    <QueensSessionQuestion
      key={question.id}
      question={question}
      progress={question.progress}
      draftQueens={draftQueens}
      locked={locked}
      validationState={queensState}
      validationStatusVisible={queensStatusVisible}
      validationError={queensError}
      onDraft={onQueensDraft}
      onValidate={onQueensValidate}
      onRetry={onRetryQueensValidation}
    />
  );
}
