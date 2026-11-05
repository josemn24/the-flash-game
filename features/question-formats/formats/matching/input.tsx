"use client";
import { ServerMatchingQuestion } from "@/components/questions/formats/matching/ServerMatchingQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"matching">) {
  const {
    locked,
    pendingAnswer,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onSubmit,
    onProgress,
  } = props;
  const { question } = props;
  return (
    <ServerMatchingQuestion
      key={question.id}
      leftItems={question.leftItems}
      rightItems={question.rightItems}
      pendingAnswer={pendingAnswer}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onSubmit={onSubmit}
      onProgress={onProgress}
      onRetry={onRetrySubmission}
    />
  );
}
