import type { AnswerValue } from "@/types/question";

export type AnswerStatus = "correct" | "partial" | "incorrect" | "unanswered";

export type AnswerResultDetails =
  | {
      type: "logic-code";
      submittedCodes: string[];
      incorrectAttempts: number;
    }
  | {
      type: "estimation";
      difference: number;
      proximity: number;
    }
  | {
      type: "matching";
      correctPairs: number;
      totalPairs: number;
      incorrectAttempts: number;
    };

export type AnswerResult = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points: number;
  timeUsed: number;
  details?: AnswerResultDetails;
};
