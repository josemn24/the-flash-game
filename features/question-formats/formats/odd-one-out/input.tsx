"use client";
import { OddOneOutQuestion } from "@/components/questions/formats/odd-one-out/OddOneOutQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "odd-one-out" }
  >;
  return (
    <>
      <OddOneOutQuestion items={[...question.items]} locked={locked} onSubmit={onSubmit} />
    </>
  );
}
