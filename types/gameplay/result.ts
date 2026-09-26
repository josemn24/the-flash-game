import type { AnswerValue } from "@/types/question";
import type { AnswerResultDetails } from "@/types/contracts/result-details";

export type { AnswerResultDetails } from "@/types/contracts/result-details";

export type AnswerStatus = "correct" | "partial" | "incorrect" | "unanswered";

export type AnswerResult = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points: number;
  timeUsed: number;
  details?: AnswerResultDetails;
};
