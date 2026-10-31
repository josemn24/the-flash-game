"use client";
import { ServerOperationStatus } from "@/components/questions/shared";
import { ConnectPairsQuestion } from "@/components/questions/formats/connect-pairs/ConnectPairsQuestion";
import type { ConnectPairsQuestion as ClientConnectPairsQuestion } from "@/types/gameplay/practice";
import type { CompetitiveInputProps } from "../../competitiveInputTypes";
export function render(props: CompetitiveInputProps<"connect-pairs">) {
  const { locked, pendingAnswer, onSubmit, onProgress } = props;
  const { question } = props;
  return (
    <>
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
          pendingAnswer ??
          (question.progress ? { paths: question.progress.paths as Record<string, number[]> } : undefined)
        }
        locked={locked}
        onProgress={onProgress}
        onSubmit={onSubmit}
      />
      <ServerOperationStatus
        state={props.submissionState}
        visible={props.submissionStatusVisible}
        errorMessage={props.submissionError}
        pendingMessage="Comprobando los caminos…"
        retryLabel="Reintentar respuesta"
        onRetry={locked ? props.onRetrySubmission : undefined}
      />
    </>
  );
}
