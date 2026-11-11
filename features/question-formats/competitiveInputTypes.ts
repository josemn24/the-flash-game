import type { AnswerValue, AnswerValueOfType } from "@/types/contracts";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";

type Base<T extends CompetitiveQuestionType> = {
  readonly question: Extract<ServerFlashQuestion, { type: T }>;
  readonly locked: boolean;
};
type Answer<T extends CompetitiveQuestionType> = {
  readonly onSubmit: (answer: AnswerValueOfType<T>) => void;
};
type Progress<T extends CompetitiveQuestionType> = {
  readonly onProgress: (answer: AnswerValueOfType<T>) => void;
};
type Draft<T extends CompetitiveQuestionType> = Progress<T> & {
  readonly pendingAnswer?: AnswerValueOfType<T> | null;
};
type Submission = {
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetrySubmission?: () => void;
};

export type CompetitiveInputByFormat = {
  readonly anagram: Base<"anagram"> & Answer<"anagram">;
  readonly classification: Base<"classification"> &
    Answer<"classification"> &
    Draft<"classification">;
  readonly "connect-pairs": Base<"connect-pairs"> &
    Answer<"connect-pairs"> &
    Draft<"connect-pairs"> &
    Submission;
  readonly escape: Base<"escape"> & Answer<"escape"> & Progress<"escape"> & Submission;
  readonly estimation: Base<"estimation"> & Answer<"estimation"> & Draft<"estimation">;
  readonly "heat-map": Base<"heat-map"> & Answer<"heat-map"> & Draft<"heat-map">;
  readonly "logic-code": Base<"logic-code"> &
    Submission & { readonly onLogicCodeAttempt: (code: string) => void };
  readonly "logic-matrix": Base<"logic-matrix"> & Answer<"logic-matrix">;
  readonly matching: Base<"matching"> & Answer<"matching"> & Draft<"matching"> & Submission;
  readonly "mini-wordle": Base<"mini-wordle"> &
    Submission & { readonly onMiniWordleGuess: (guess: string) => void };
  readonly "multiple-choice": Base<"multiple-choice"> &
    Answer<"multiple-choice"> & {
      readonly pendingAnswer?: AnswerValueOfType<"multiple-choice"> | null;
    };
  readonly "odd-one-out": Base<"odd-one-out"> & Answer<"odd-one-out">;
  readonly ordering: Base<"ordering"> & Answer<"ordering"> & Draft<"ordering">;
  readonly "progressive-clues": Base<"progressive-clues"> &
    Answer<"progressive-clues"> &
    Submission & {
      readonly revealState: "idle" | "submitting" | "error";
      readonly revealStatusVisible: boolean;
      readonly revealError?: string;
      readonly onRevealProgressiveClue: () => void;
      readonly onRetryReveal?: () => void;
    };
  readonly "progressive-image": Base<"progressive-image"> &
    Answer<"progressive-image"> &
    Submission & { readonly presentedAt?: number | null };
  readonly queens: Base<"queens"> & {
    readonly draftQueens?: readonly number[];
    readonly queensState: "idle" | "submitting" | "error";
    readonly queensStatusVisible: boolean;
    readonly queensError?: string;
    readonly onQueensDraft: (queens: readonly number[]) => void;
    readonly onQueensValidate: (queens: readonly number[]) => void;
    readonly onRetryQueensValidation?: () => void;
  };
  readonly "short-text": Base<"short-text"> & Answer<"short-text">;
  readonly "true-false": Base<"true-false"> & Answer<"true-false">;
  readonly "word-hashtag": Base<"word-hashtag"> &
    Submission & { readonly onWordHashtagSwap: (fromCell: number, toCell: number) => void };
  readonly "word-search": Base<"word-search"> & {
    readonly wordSearchState: "idle" | "submitting" | "error";
    readonly wordSearchStatusVisible: boolean;
    readonly wordSearchError?: string;
    readonly lastWordSearchSelection?: {
      readonly startCell: number;
      readonly endCell: number;
      readonly correct: boolean;
    };
    readonly onWordSearchSelection: (startCell: number, endCell: number) => void;
    readonly onRetryWordSearch?: () => void;
  };
  readonly zip: Base<"zip"> & Answer<"zip"> & Draft<"zip"> & Submission;
};

export type CompetitiveInputProps<T extends CompetitiveQuestionType> = CompetitiveInputByFormat[T];
export type MiniWordleCompetitiveInputProps = CompetitiveInputByFormat["mini-wordle"];
export type CompetitiveInput = {
  [T in CompetitiveQuestionType]: {
    readonly context: "competitive";
    readonly format: T;
    readonly props: CompetitiveInputByFormat[T];
  };
}[CompetitiveQuestionType];

/** Adapter-only projection. No renderer or presentation component accepts this source. */
export type CompetitiveInputSource = {
  readonly question: ServerFlashQuestion | null;
  readonly locked: boolean;
  readonly pendingAnswer?: AnswerValue | null;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly retrySubmit?: () => void;
  readonly submit: (answer: AnswerValue) => void;
  readonly updateDraft: (answer: AnswerValue) => void;
  readonly submitMiniWordleGuess: (guess: string) => void;
  readonly submitLogicCodeAttempt: (code: string) => void;
  readonly queensState: "idle" | "submitting" | "error";
  readonly queensStatusVisible: boolean;
  readonly queensError?: string;
  readonly updateQueensDraft: (queens: readonly number[]) => void;
  readonly validateQueensBoard: (queens: readonly number[]) => void;
  readonly retryQueensValidation?: () => void;
  readonly wordSearchState: "idle" | "submitting" | "error";
  readonly wordSearchStatusVisible: boolean;
  readonly wordSearchError?: string;
  readonly lastWordSearchSelection?: {
    readonly startCell: number;
    readonly endCell: number;
    readonly correct: boolean;
  };
  readonly submitWordSearchSelection: (startCell: number, endCell: number) => void;
  readonly retryWordSearchSelection?: () => void;
  readonly submitWordHashtagSwap: (fromCell: number, toCell: number) => void;
  readonly revealState: "idle" | "submitting" | "error";
  readonly revealStatusVisible: boolean;
  readonly revealError?: string;
  readonly revealProgressiveClue: () => void;
  readonly retryReveal?: () => void;
  readonly questionPresentedAt?: number | null;
};
