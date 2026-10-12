"use client";
import { ProgressiveImageQuestion } from "@/components/questions/formats/progressive-image/ProgressiveImageQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const {
    locked,
    submissionState,
    submissionStatusVisible,
    submissionError,
    onRetrySubmission,
    onSubmit,
    presentedAt,
  } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "progressive-image" }
  >;
  return (
    <ProgressiveImageQuestion
      surface={question.surface}
      revealDuration={question.revealDuration}
      answerLabel={question.answerLabel ?? undefined}
      answerPlaceholder={question.answerPlaceholder ?? undefined}
      locked={locked}
      presentedAtMs={presentedAt ?? undefined}
      onTimedResponseStart={() => undefined}
      onSubmit={onSubmit}
      submissionState={submissionState}
      submissionStatusVisible={submissionStatusVisible}
      submissionError={submissionError}
      onRetrySubmission={onRetrySubmission}
    />
  );
}
