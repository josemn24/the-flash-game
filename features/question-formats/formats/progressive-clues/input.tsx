"use client";
import { ServerProgressiveCluesQuestion } from "@/components/questions/formats/progressive-clues/ServerProgressiveCluesQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onSubmit,
    revealState,
    revealStatusVisible,
    revealError,
    onRevealProgressiveClue,
    onRetryReveal,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "progressive-clues" }
  >;
  return (
    <ServerProgressiveCluesQuestion
      progress={question.progress}
      locked={locked}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetry={onRetrySubmission}
      revealState={revealState}
      revealStatusVisible={revealStatusVisible}
      revealError={revealError}
      onReveal={onRevealProgressiveClue}
      onRetryReveal={onRetryReveal}
      onSubmit={(answer) => onSubmit(answer)}
    />
  );
}
