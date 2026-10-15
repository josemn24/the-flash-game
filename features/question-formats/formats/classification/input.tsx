"use client";
import { ClassificationQuestion } from "@/components/questions/formats/classification/ClassificationQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"classification">) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const { question } = props;
  return (
    <>
      <ClassificationQuestion
        items={[...question.items]}
        categories={[...question.categories]}
        initialAnswer={pendingAnswer ?? undefined}
        locked={locked}
        onProgress={onProgress}
        onSubmit={onSubmit}
      />
    </>
  );
}
