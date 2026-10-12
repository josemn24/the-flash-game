"use client";
import { ServerWordHashtagQuestion } from "@/components/questions/formats/word-hashtag/ServerWordHashtagQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onWordHashtagSwap,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "word-hashtag" }
  >;
  return (
    <ServerWordHashtagQuestion
      key={question.id}
      question={question}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetry={onRetrySubmission}
      onSwap={onWordHashtagSwap}
    />
  );
}
