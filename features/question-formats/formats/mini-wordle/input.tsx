"use client";
import { ServerMiniWordleQuestion } from "@/components/questions/formats/mini-wordle/ServerMiniWordleQuestion";
import type { MiniWordleCompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: MiniWordleCompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onMiniWordleGuess,
  } = props;
  const { question } = props;
  return (
    <ServerMiniWordleQuestion
      question={question}
      progress={question.progress}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetry={onRetrySubmission}
      onSubmit={onMiniWordleGuess}
    />
  );
}
