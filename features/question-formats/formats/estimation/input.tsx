"use client";
import { EstimationQuestion } from "@/components/questions/formats/estimation/EstimationQuestion";
import { QuestionMedia } from "@/components/questions/shared";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "estimation" }
  >;
  return (
    <>
      {question.media ? (
        <div className="mt-5">
          <QuestionMedia media={question.media} prominent />
        </div>
      ) : null}
      <EstimationQuestion
        min={question.min}
        max={question.max}
        step={question.step}
        value={typeof pendingAnswer === "number" ? pendingAnswer : question.initialValue}
        unit={question.unit}
        locked={locked}
        onChange={onProgress}
        onSubmit={onSubmit}
      />
    </>
  );
}
