import type { AnswerStatus } from "@/types/game";

export const FLASH_POP_FEEDBACK_DURATION: Record<AnswerStatus, number> = {
  correct: 1100,
  partial: 1100,
  incorrect: 1800,
  unanswered: 1800,
};
