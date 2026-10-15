"use client";
import { ServerZipQuestion } from "@/components/questions/formats/zip/ServerZipQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"zip">) {
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
    <ServerZipQuestion
      question={question}
      initialAnswer={pendingAnswer ?? undefined}
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
