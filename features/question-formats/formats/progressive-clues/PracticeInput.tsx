"use client";

import { ProgressiveCluesQuestion } from "@/components/questions";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { QuestionInputProps } from "../../rendererTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onProgressiveClueReveal,
  onSubmit,
  progressiveCluesRevealed,
}: QuestionInputProps<PracticeQuestionOfType<"progressive-clues">>) {
  return (
    <ProgressiveCluesQuestion
      questionId={question.id}
      clues={question.clues}
      cluePenalty={question.cluePenalty}
      points={question.points}
      initialAnswer={typeof initialAnswer === "string" ? initialAnswer : undefined}
      initialRevealedClues={progressiveCluesRevealed}
      locked={locked}
      onReveal={onProgressiveClueReveal}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
