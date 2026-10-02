"use client";
import { ServerZipQuestion } from "@/components/questions/formats/zip/ServerZipQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
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
  const question = props.question as Extract<CompetitiveInputProps["question"], { type: "zip" }>;
  return (
    <ServerZipQuestion
      question={question}
      initialAnswer={
        pendingAnswer &&
        typeof pendingAnswer === "object" &&
        !Array.isArray(pendingAnswer) &&
        "path" in pendingAnswer &&
        Array.isArray((pendingAnswer as { path?: unknown }).path)
          ? (pendingAnswer as { path: number[] })
          : undefined
      }
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
