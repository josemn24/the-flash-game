"use client";
import { OddOneOutQuestion } from "@/components/questions/formats/odd-one-out/OddOneOutQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"odd-one-out">) {
  const { locked, onSubmit } = props;
  const { question } = props;
  return (
    <>
      <OddOneOutQuestion items={[...question.items]} locked={locked} onSubmit={onSubmit} />
    </>
  );
}
