"use client";
import { ConnectPairsQuestion } from "@/components/questions/formats/connect-pairs/ConnectPairsQuestion";
import type { ConnectPairsQuestion as ClientConnectPairsQuestion } from "@/types/gameplay/practice";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const question = props.question as Extract<
    CompetitiveInputProps["question"],
    { type: "connect-pairs" }
  >;
  return (
    <ConnectPairsQuestion
      question={
        {
          id: question.id,
          type: "connect-pairs",
          category: question.category,
          tags: question.tags,
          question: question.question,
          grid: question.grid,
          pairs: [...question.pairs],
          solutionPaths: {},
          requireFullCoverage: true,
          timeLimit: question.timeLimit,
          points: question.points,
          explanation: "",
        } satisfies ClientConnectPairsQuestion
      }
      initialAnswer={
        pendingAnswer &&
        typeof pendingAnswer === "object" &&
        !Array.isArray(pendingAnswer) &&
        "paths" in pendingAnswer &&
        pendingAnswer.paths &&
        typeof pendingAnswer.paths === "object" &&
        !Array.isArray(pendingAnswer.paths)
          ? (pendingAnswer as { paths: Record<string, number[]> })
          : undefined
      }
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
