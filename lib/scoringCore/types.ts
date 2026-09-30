import type {
  AnswerResultDetails,
  AnswerStatus,
  ResolvedAnswerValue,
  ResolvedQuestion,
  QuestionType,
} from "@/types/gameplay/scoring";

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
  question: ResolvedQuestion;
  answer: ResolvedAnswerValue;
  timeUsed: number;
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
  availablePoints?: number;
};

export type EvaluationInput = {
  question: ResolvedQuestion;
  answer: ResolvedAnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
  incorrectAttempts?: number;
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
  progressiveClueAvailablePoints?: number;
};

export type NormalizedEvaluationInput = {
  question: ResolvedQuestion;
  answer: ResolvedAnswerValue;
  timeUsed: number;
  timedOut: boolean;
  submittedCodes: string[];
  incorrectAttempts: number;
  matchingIncorrectAttempts: number;
  progressiveCluesRevealed: number;
  progressiveClueAvailablePoints?: number;
  isCorrect: boolean;
};

export type NormalizedUnansweredInput = {
  question: ResolvedQuestion;
  answer: null;
  timeUsed: number;
  timedOut: boolean;
  submittedCodes: string[];
  incorrectAttempts: number;
  matchingIncorrectAttempts: number;
  progressiveCluesRevealed: number;
  progressiveClueAvailablePoints?: number;
};

export type UnansweredDetailsContext = {
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
  availablePoints?: number;
};

export type TimeoutAnswerSource = "none" | "draft" | "last-submitted-code";

export type TimeoutPolicy = {
  readonly answerSource?: TimeoutAnswerSource;
  readonly preservePoints?: boolean;
  buildUnansweredDetailsContext?(input: NormalizedUnansweredInput): UnansweredDetailsContext;
  unansweredDetails?(
    question: ResolvedQuestion,
    context: UnansweredDetailsContext,
  ): AnswerResultDetails | undefined;
  status?(evaluation: InternalEvaluation, question: ResolvedQuestion): AnswerStatus | undefined;
};

export type QuestionScoring = {
  readonly questionType: QuestionType;
  readonly policy: ScoringPolicyId;
  readonly timeoutPolicy?: TimeoutPolicy;
  // Shape guard only: validate that the scorer can process this answer.
  // ResolvedQuestion-specific correctness and configuration checks stay in the scorer.
  isAnswer(answer: ResolvedAnswerValue | null): boolean;
  isCorrect(question: ResolvedQuestion, answer: ResolvedAnswerValue): boolean;
  buildEvaluationContext?(input: NormalizedEvaluationInput): EvaluationContext;
  evaluate(context: EvaluationContext): InternalEvaluation;
};
