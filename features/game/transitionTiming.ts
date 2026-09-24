import type { AnswerStatus } from "@/types/game";

export const FLASH_POP_FEEDBACK_DURATION: Record<AnswerStatus, number> = {
  correct: 1100,
  partial: 1100,
  incorrect: 1800,
  unanswered: 1800,
};

export const MINI_WORDLE_ANSWER_REVEAL_DURATION = 700;
