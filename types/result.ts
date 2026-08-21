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
      type: "connect-pairs";
      connectedPairs: number;
      totalPairs: number;
      coveredCells: number;
      totalCells: number;
      coverage: number;
      conflicts: number;
    }
  | {
      type: "flash-memory";
      correctPlacements: number;
      totalPlacements: number;
    }
  | {
      type: "memory-pairs";
      matchedPairs: number;
      totalPairs: number;
      incorrectAttempts: number;
      totalAttempts: number;
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
      type: "queens";
      placedQueens: number;
      completedRows: number;
      completedColumns: number;
      completedRegions: number;
      conflictingQueens: number;
      incorrectAttempts: number;
      marksUsed: number;
      solved: boolean;
    }
  | {
      type: "time-maze";
      moves: number;
      optimalMoves: number;
      reachedExit: boolean;
    }
  | {
      type: "zip";
      coveredCells: number;
      totalCells: number;
      reachedCheckpoint: number;
      totalCheckpoints: number;
      completed: boolean;
    }
  | {
      type: "pipes";
      connectedTiles: number;
      totalTiles: number;
      openConnections: number;
      isolatedComponents: number;
      moves: number;
      solved: boolean;
    }
  | {
      type: "sliding-puzzle";
      moves: number;
    }
  | {
      type: "escape";
      moves: number;
      optimalMoves: number;
      escaped: boolean;
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
    }
  | {
      type: "word-hashtag";
      correctCells: number;
      totalCells: number;
      completedWords: number;
      totalWords: number;
      movesUsed: number;
      movesRemaining: number;
      optimalMoves: number;
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
