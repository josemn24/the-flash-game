"use client";
import { ClassificationQuestion } from "@/components/questions/formats/classification/ClassificationQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "classification" }
  >;
  return (
    <>
      <ClassificationQuestion
        items={[...question.items]}
        categories={[...question.categories]}
        initialAnswer={
          pendingAnswer && typeof pendingAnswer === "object" && !Array.isArray(pendingAnswer)
            ? (pendingAnswer as Record<string, string>)
            : undefined
        }
        locked={locked}
        onProgress={onProgress}
        onSubmit={onSubmit}
      />
    </>
  );
}
