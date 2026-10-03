"use client";

import { AnswerOption, NumberSequencePrompt, ServerOperationStatus } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
  pendingAnswer,
  submissionState,
  submissionStatusVisible = false,
  submissionError,
  onRetrySubmission,
}: QuestionInputProps<PracticeQuestionOfType<"multiple-choice">>) {
  const selectedAnswer = typeof pendingAnswer === "string" ? pendingAnswer : null;
  const resolvedSubmissionState = submissionState ?? "idle";
  const submissionFeedbackEnabled = submissionState !== undefined;

  return (
    <>
      {question.promptVisual?.type === "number-sequence" && (
        <NumberSequencePrompt prompt={question.promptVisual} />
      )}
      <div
        className={`${question.promptVisual ? "mt-4" : "mt-7 sm:mt-8"} grid gap-2.5 sm:grid-cols-2 sm:gap-3`}
      >
        {question.options.map((option, index) => (
          <AnswerOption
            key={option}
            label={option}
            index={index}
            selected={selectedAnswer === option}
            pending={selectedAnswer === option}
            disabled={locked}
            onSelect={() => onSubmit(option)}
          />
        ))}
      </div>
      {submissionFeedbackEnabled ? (
        <ServerOperationStatus
          state={resolvedSubmissionState}
          visible={submissionStatusVisible}
          pendingMessage="Comprobando respuesta…"
          errorMessage={submissionError ?? "No hemos podido confirmar tu respuesta."}
          retryLabel="Reintentar"
          onRetry={onRetrySubmission}
        />
      ) : null}
    </>
  );
}
