"use client";
import { AnswerOption, NumberSequencePrompt, QuestionMedia } from "@/components/questions/shared";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"multiple-choice">) {
  const { locked, onSubmit, pendingAnswer } = props;
  const { question } = props;
  const selected = typeof pendingAnswer === "string" ? pendingAnswer : null;
  return (
    <>
      {question.type === "multiple-choice" && question.media ? (
        <div className="mt-5">
          <QuestionMedia media={question.media} prominent />
        </div>
      ) : null}
      {question.type === "multiple-choice" && question.promptVisual?.type === "number-sequence" ? (
        <NumberSequencePrompt prompt={question.promptVisual} />
      ) : null}
      <div
        className={`${question.type === "multiple-choice" && question.promptVisual ? "mt-4" : "mt-7"} grid gap-2.5 sm:grid-cols-2 sm:gap-3`}
      >
        {question.type === "multiple-choice"
          ? question.options.map((option, index) => (
              <AnswerOption
                key={option}
                label={option}
                index={index}
                selected={selected === option}
                pending={selected === option}
                disabled={locked}
                onSelect={() => onSubmit(option)}
              />
            ))
          : null}
      </div>
    </>
  );
}
