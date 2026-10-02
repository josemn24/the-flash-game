"use client";
import { HeatMapQuestion } from "@/components/questions/formats/heat-map/HeatMapQuestion";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "heat-map" }
  >;
  return (
    <>
      {question.surface ? (
        <div className="mt-5">
          <HeatMapQuestion
            key={`${question.id}:${pendingAnswer && typeof pendingAnswer === "object" ? "draft" : "initial"}`}
            question={{ surface: question.surface }}
            initialAnswer={
              pendingAnswer &&
              typeof pendingAnswer === "object" &&
              !Array.isArray(pendingAnswer) &&
              typeof (pendingAnswer as Record<string, unknown>).x === "number" &&
              typeof (pendingAnswer as Record<string, unknown>).y === "number"
                ? (pendingAnswer as { x: number; y: number })
                : undefined
            }
            locked={locked}
            onProgress={onProgress}
            onSubmit={onSubmit}
          />
        </div>
      ) : null}
    </>
  );
}
