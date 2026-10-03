"use client";

import { EstimationQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import { useState } from "react";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  onSubmit,
}: QuestionInputProps<PracticeQuestionOfType<"estimation">>) {
  return (
    <LocalEstimationInput
      key={question.id}
      question={question}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function LocalEstimationInput({
  question,
  locked,
  onSubmit,
}: Pick<
  QuestionInputProps<PracticeQuestionOfType<"estimation">>,
  "question" | "locked" | "onSubmit"
>) {
  const [value, setValue] = useState(question.initialValue);

  return (
    <EstimationQuestion
      min={question.min}
      max={question.max}
      step={question.step}
      value={value}
      unit={question.unit}
      locked={locked}
      onChange={setValue}
      onSubmit={onSubmit}
    />
  );
}
