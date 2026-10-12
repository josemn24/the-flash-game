"use client";
import { ServerMiniWordleQuestion } from "@/components/questions/formats/mini-wordle/ServerMiniWordleQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onMiniWordleGuess,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "mini-wordle" }
  >;
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
