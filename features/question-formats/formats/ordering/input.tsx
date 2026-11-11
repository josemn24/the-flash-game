"use client";
import { OrderingQuestion } from "@/components/questions/formats/ordering/OrderingQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"ordering">) {
  const { locked, onSubmit, onProgress, pendingAnswer } = props;
  const { question } = props;
  return (
    <>
      <OrderingQuestion
        items={[...question.items]}
        directionLabels={question.directionLabels ?? undefined}
        locked={locked}
        initialItems={pendingAnswer ?? undefined}
        onProgress={onProgress}
        onSubmit={onSubmit}
      />
    </>
  );
}
