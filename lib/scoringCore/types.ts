import type {
  AnswerResultDetails,
  AnswerStatus,
  AnswerValue,
  Question,
  QuestionType,
} from "@/types/game";

export type ScoringPolicyId =
  | "binary-speed"
  | "partial-items"
  | "attempt-penalty"
  | "proximity"
  | "clue-speed"
  | "spatial-proximity"
  | "image-labeling"
  | "error-location-correction";

export type InternalEvaluation = {
  isCorrect: boolean;
  status: AnswerStatus;
  points: number;
  details?: AnswerResultDetails;
};

export type EvaluationContext = {
  question: Question;
  answer: AnswerValue;
  timeUsed: number;
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
};

export type EvaluationInput = {
  question: Question;
  answer: AnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
};

export type UnansweredDetailsContext = {
  submittedCodes: string[];
  revealedClues: number;
};

export type QuestionScoring = {
  readonly questionType: QuestionType;
  readonly policy: ScoringPolicyId;
  readonly preserveTimedOutPoints?: boolean;
  isAnswer(answer: AnswerValue | null): boolean;
  isCorrect(question: Question, answer: AnswerValue): boolean;
  evaluate(context: EvaluationContext): InternalEvaluation;
  unansweredDetails?(
    question: Question,
    context: UnansweredDetailsContext,
  ): AnswerResultDetails | undefined;
  timedOutStatus?(evaluation: InternalEvaluation, question: Question): AnswerStatus | undefined;
};
