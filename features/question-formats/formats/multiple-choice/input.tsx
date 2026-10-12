"use client";
import { AnswerOption, QuestionMedia } from "@/components/questions/shared";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit, pendingAnswer } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "multiple-choice" }
  >;
  const selected = typeof pendingAnswer === "string" ? pendingAnswer : null;
  return (
    <>
      {question.type === "multiple-choice" && question.media ? (
        <div className="mt-5">
          <QuestionMedia media={question.media} prominent />
        </div>
      ) : null}
      <div className="mt-7 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
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
