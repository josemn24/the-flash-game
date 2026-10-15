"use client";
import { ServerQueensQuestion } from "@/components/questions/formats/queens/ServerQueensQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"queens">) {
  const {
    locked,
    queensState,
    queensStatusVisible,
    queensError,
    onQueensDraft,
    onQueensValidate,
    onRetryQueensValidation,
  } = props;
  const { question } = props;
  return (
    <ServerQueensQuestion
      key={question.id}
      question={question}
      progress={question.progress}
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
