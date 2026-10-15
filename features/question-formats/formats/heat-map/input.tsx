"use client";
import { HeatMapQuestion } from "@/components/questions/formats/heat-map/HeatMapQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"heat-map">) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const { question } = props;
  return (
    <>
      {question.surface ? (
        <div className="mt-5">
          <HeatMapQuestion
            key={`${question.id}:${pendingAnswer && typeof pendingAnswer === "object" ? "draft" : "initial"}`}
            question={{ surface: question.surface }}
            initialAnswer={pendingAnswer ?? undefined}
            locked={locked}
            onProgress={onProgress}
            onSubmit={onSubmit}
          />
        </div>
      ) : null}
    </>
  );
}
