import type {
  PracticeAnswerValueOfType,
  PracticeQuestion,
  PracticeQuestionType,
} from "@/types/gameplay/practice";

import type { AnswerResult } from "@/types/gameplay/result";

type CommonProps<T extends PracticeQuestionType> = {
  locked: boolean;
  onSubmit: (answer: PracticeAnswerValueOfType<T>) => void;
  pendingAnswer?: PracticeAnswerValueOfType<T> | null;
  submissionState?: "idle" | "submitting" | "error";
  submissionStatusVisible?: boolean;
  submissionError?: string;
  onRetrySubmission?: () => void;
  codeAttemptCount?: number;
  onCodeAttempt: (code: string) => boolean;
  onProgress: (answer: PracticeAnswerValueOfType<T>) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
  initialAnswer?: PracticeAnswerValueOfType<T> | null;
  progressiveCluesRevealed?: number;
};

export type QuestionInputProps<T extends PracticeQuestion = PracticeQuestion> = CommonProps<
  T["type"]
> & {
  question: T;
};

export type ReviewProps<T extends PracticeQuestion = PracticeQuestion> = {
  question: T;
  result: AnswerResult;
};
