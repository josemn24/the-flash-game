import type { AnswerValue } from "@/types/contracts";
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
  reviewState?: ReviewState;
};

/** Review-only snapshot of accepted progress captured at closure. */
export type ReviewState =
  | { readonly type: "connect-pairs"; readonly paths: Readonly<Record<string, readonly number[]>> }
  | { readonly type: "queens"; readonly queens: readonly number[] }
  | { readonly type: "word-search"; readonly foundWordIds: readonly string[] }
  | PyramidDraftReviewState;

export type PyramidDraftReviewState =
  | { readonly type: "matching" | "classification"; readonly answer: Record<string, string> }
  | { readonly type: "ordering"; readonly answer: string[] };
