"use client";

import { useCallback, useState } from "react";
import type { PracticeQuestion } from "@/types/gameplay/practice";

const DELAYED_TIMER_TYPES = new Set<PracticeQuestion["type"]>([
  "flash-memory",
  "simon-sequence",
  "mini-wordle",
  "progressive-image",
]);

export function isDelayedQuestionTimer(question: Pick<PracticeQuestion, "type">) {
  return DELAYED_TIMER_TYPES.has(question.type);
}

type UseQuestionStageTimerOptions = {
  question: PracticeQuestion;
  locked: boolean;
  deadlineAt?: number | null;
  onTimeUp: () => void;
  onTimedResponseStart: () => void;
};

export function useQuestionStageTimer({
  question,
  locked,
  deadlineAt,
  onTimeUp,
  onTimedResponseStart,
}: UseQuestionStageTimerOptions) {
  const delayed = isDelayedQuestionTimer(question);
  const [startedState, setStartedState] = useState({
    questionId: question.id,
    started: !delayed,
  });
  const started = startedState.questionId === question.id ? startedState.started : !delayed;

  const start = useCallback(() => {
    setStartedState({ questionId: question.id, started: true });
    onTimedResponseStart();
  }, [onTimedResponseStart, question.id]);

  const active = !locked && started && (deadlineAt === undefined || typeof deadlineAt === "number");

  return {
    active,
    delayed,
    started,
    start,
    onTimeUp,
  };
}
