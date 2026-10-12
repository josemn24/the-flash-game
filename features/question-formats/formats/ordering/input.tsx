"use client";
import { OrderingQuestion } from "@/components/questions/formats/ordering/OrderingQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, onSubmit } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "ordering" }
  >;
  return (
    <>
      <OrderingQuestion
        items={[...question.items]}
        directionLabels={question.directionLabels ?? undefined}
        locked={locked}
        onSubmit={onSubmit}
      />
    </>
  );
}
