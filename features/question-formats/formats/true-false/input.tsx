"use client";
import { TrueFalseQuestion } from "@/components/questions/formats/true-false/TrueFalseQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit } = props;
  return (
    <>
      <TrueFalseQuestion locked={locked} onSubmit={onSubmit} />
    </>
  );
}
