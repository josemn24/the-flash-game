"use client";
import { ConnectPairsQuestion } from "@/components/questions/formats/connect-pairs/ConnectPairsQuestion";
import type { ConnectPairsQuestion as ClientConnectPairsQuestion } from "@/types/gameplay/practice";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"connect-pairs">) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const { question } = props;
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
      initialAnswer={pendingAnswer ?? undefined}
      locked={locked}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
