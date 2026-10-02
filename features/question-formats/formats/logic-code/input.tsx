"use client";
import { ServerLogicCodeQuestion } from "@/components/questions/formats/logic-code/ServerLogicCodeQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onLogicCodeAttempt,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "logic-code" }
  >;
  return (
    <ServerLogicCodeQuestion
      clues={question.clues}
      codeLength={question.codeLength}
      progress={question.progress}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetry={onRetrySubmission}
      onSubmit={onLogicCodeAttempt}
    />
  );
}
