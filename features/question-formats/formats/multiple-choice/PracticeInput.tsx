"use client";

import { AnswerOption, NumberSequencePrompt } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: PracticeInputProps<"multiple-choice">) {
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
            selected={false}
            disabled={locked}
            onSelect={() => onSubmit(option)}
          />
        ))}
      </div>
    </>
  );
}
