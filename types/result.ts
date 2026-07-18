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
      type: "flash-memory";
      correctPlacements: number;
      totalPlacements: number;
    }
  | {
      type: "simon-sequence";
      submittedSteps: string[];
      firstMismatchIndex: number | null;
    }
  | {
      type: "mini-sudoku";
      correctCells: number;
      totalCells: number;
    }
  | {
      type: "mini-nonogram";
      correctFilled: number;
      incorrectFilled: number;
      totalFilled: number;
    }
  | {
      type: "time-maze";
      moves: number;
      optimalMoves: number;
      reachedExit: boolean;
    }
  | {
      type: "sliding-puzzle";
      moves: number;
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
      task: "assign-all";
      correctLabels: number;
      totalLabels: number;
    }
  | {
      type: "image-labeling";
      task: "identify-one";
      responseKind: "choice" | "text";
    }
  | {
      type: "error-reconstruction";
      selectedStepId: string | null;
      locationCorrect: boolean;
      correctionRequired: boolean;
      correctionCorrect: boolean;
    }
  | {
      type: "mini-wordle";
      attemptsUsed: number;
      incorrectAttempts: number;
      solved: boolean;
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
