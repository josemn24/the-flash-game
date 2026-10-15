"use client";

import { ProgressiveCluesQuestion } from "@/components/questions";
import type { PracticeInputProps } from "../../practiceInputTypes";

export function PracticeInput({
  question,
  locked,
  initialAnswer,
  onProgress,
  onProgressiveClueReveal,
  onSubmit,
  progressiveCluesRevealed,
}: PracticeInputProps<"progressive-clues">) {
  return (
    <ProgressiveCluesQuestion
      questionId={question.id}
      clues={question.clues}
      cluePenalty={question.cluePenalty}
      points={question.points}
      initialAnswer={initialAnswer}
      initialRevealedClues={progressiveCluesRevealed}
      locked={locked}
      onReveal={onProgressiveClueReveal}
      onProgress={onProgress}
      onSubmit={onSubmit}
    />
  );
}
