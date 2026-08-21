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
  | "movement-penalty"
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
  incorrectAttempts?: number;
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
};

export type NormalizedEvaluationInput = {
  question: Question;
  answer: AnswerValue;
  timeUsed: number;
  timedOut: boolean;
  submittedCodes: string[];
  incorrectAttempts: number;
  matchingIncorrectAttempts: number;
  progressiveCluesRevealed: number;
  isCorrect: boolean;
};

export type NormalizedUnansweredInput = {
  question: Question;
  answer: null;
  timeUsed: number;
  timedOut: boolean;
  submittedCodes: string[];
  incorrectAttempts: number;
  matchingIncorrectAttempts: number;
  progressiveCluesRevealed: number;
};

export type UnansweredDetailsContext = {
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
};

export type TimeoutAnswerSource = "none" | "draft" | "last-submitted-code";

export type TimeoutPolicy = {
  readonly answerSource?: TimeoutAnswerSource;
  readonly preservePoints?: boolean;
  buildUnansweredDetailsContext?(input: NormalizedUnansweredInput): UnansweredDetailsContext;
  unansweredDetails?(
    question: Question,
    context: UnansweredDetailsContext,
  ): AnswerResultDetails | undefined;
  status?(evaluation: InternalEvaluation, question: Question): AnswerStatus | undefined;
};

export type QuestionScoring = {
  readonly questionType: QuestionType;
  readonly policy: ScoringPolicyId;
  readonly timeoutPolicy?: TimeoutPolicy;
  // Shape guard only: validate that the scorer can process this answer.
  // Question-specific correctness and configuration checks stay in the scorer.
  isAnswer(answer: AnswerValue | null): boolean;
  isCorrect(question: Question, answer: AnswerValue): boolean;
  buildEvaluationContext?(input: NormalizedEvaluationInput): EvaluationContext;
  evaluate(context: EvaluationContext): InternalEvaluation;
};
