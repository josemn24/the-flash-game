import type { AnswerValue, NormalizedPoint } from "@/types/question";

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
    }
  | {
      type: "progressive-clues";
      revealedClues: number;
      totalClues: number;
      availablePoints: number;
    }
  | {
      type: "heat-map";
      selectedPoint: NormalizedPoint;
      targetPoint: NormalizedPoint;
      distance: number;
      accuracy: number;
    }
  | {
      type: "image-labeling";
      correctLabels: number;
      totalLabels: number;
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
