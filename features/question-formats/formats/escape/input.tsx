"use client";
import { ServerEscapeQuestion } from "@/components/questions/formats/escape/ServerEscapeQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onSubmit,
    onProgress,
  } = props;
  const question = props.question as Extract<CompetitiveInputProps["question"], { type: "escape" }>;
  return (
    <ServerEscapeQuestion
      question={question}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetry={onRetrySubmission}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
