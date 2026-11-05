"use client";

import { EstimationQuestion } from "@/components/questions";
import { useState } from "react";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({ question, locked, onSubmit }: PracticeInputProps<"estimation">) {
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
}: Pick<PracticeInputProps<"estimation">, "question" | "locked" | "onSubmit">) {
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
