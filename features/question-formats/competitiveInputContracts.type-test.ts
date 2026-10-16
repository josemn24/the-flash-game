import type { AnswerValueOfType } from "@/types/contracts";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import type {
  CompetitiveInput,
  CompetitiveInputByFormat,
  MiniWordleCompetitiveInputProps,
} from "./competitiveInputTypes";

type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AllTrue<T> = Exclude<T, true> extends never ? true : false;

/** Exact public surface for every renderer: adding another format's operation fails compilation. */
type ExpectedKeys = {
  anagram: "question" | "locked" | "onSubmit";
  classification: "question" | "locked" | "onSubmit" | "onProgress" | "pendingAnswer";
  "connect-pairs":
    | "question"
    | "locked"
    | "onSubmit"
    | "onProgress"
    | "pendingAnswer"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission";
  escape:
    | "question"
    | "locked"
    | "onSubmit"
    | "onProgress"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission";
  estimation: "question" | "locked" | "onSubmit" | "onProgress" | "pendingAnswer";
  "heat-map": "question" | "locked" | "onSubmit" | "onProgress" | "pendingAnswer";
  "logic-code":
    | "question"
    | "locked"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission"
    | "onLogicCodeAttempt";
  "logic-matrix": "question" | "locked" | "onSubmit";
  matching:
    | "question"
    | "locked"
    | "onSubmit"
    | "onProgress"
    | "pendingAnswer"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission";
  "mini-wordle":
    | "question"
    | "locked"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission"
    | "onMiniWordleGuess";
  "multiple-choice": "question" | "locked" | "onSubmit" | "pendingAnswer";
  "odd-one-out": "question" | "locked" | "onSubmit";
  ordering: "question" | "locked" | "onSubmit";
  "progressive-clues":
    | "question"
    | "locked"
    | "onSubmit"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission"
    | "revealState"
    | "revealStatusVisible"
    | "revealError"
    | "onRevealProgressiveClue"
    | "onRetryReveal";
  "progressive-image":
    | "question"
    | "locked"
    | "onSubmit"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission"
    | "presentedAt";
  queens:
    | "question"
    | "locked"
    | "queensState"
    | "queensStatusVisible"
    | "queensError"
    | "onQueensDraft"
    | "onQueensValidate"
    | "onRetryQueensValidation";
  "short-text": "question" | "locked" | "onSubmit";
  "true-false": "question" | "locked" | "onSubmit";
  "word-hashtag":
    | "question"
    | "locked"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission"
    | "onWordHashtagSwap";
  "word-search":
    | "question"
    | "locked"
    | "wordSearchState"
    | "wordSearchStatusVisible"
    | "wordSearchError"
    | "lastWordSearchSelection"
    | "onWordSearchSelection"
    | "onRetryWordSearch";
  zip:
    | "question"
    | "locked"
    | "onSubmit"
    | "onProgress"
    | "pendingAnswer"
    | "submissionState"
    | "submissionStatusVisible"
    | "submissionError"
    | "onRetrySubmission";
};
type QuestionChecks = {
  [T in CompetitiveQuestionType]: Equal<
    CompetitiveInputByFormat[T]["question"],
    Extract<ServerFlashQuestion, { type: T }>
  >;
};
type KeyChecks = {
  [T in CompetitiveQuestionType]: Equal<keyof CompetitiveInputByFormat[T], ExpectedKeys[T]>;
};
type UnionChecks = {
  [T in CompetitiveQuestionType]: Equal<
    Extract<CompetitiveInput, { format: T }>["props"],
    CompetitiveInputByFormat[T]
  >;
};
type AnswerFormats = {
  [T in CompetitiveQuestionType]: CompetitiveInputByFormat[T] extends {
    onSubmit: (...args: never[]) => void;
  }
    ? T
    : never;
}[CompetitiveQuestionType];
type AnswerChecks = {
  [T in AnswerFormats]: Equal<
    Parameters<CompetitiveInputByFormat[T]["onSubmit"]>[0],
    AnswerValueOfType<T>
  >;
};
type ProgressFormats =
  "classification" | "connect-pairs" | "estimation" | "heat-map" | "matching" | "zip" | "escape";
type ProgressChecks = {
  [T in ProgressFormats]: Equal<
    Parameters<CompetitiveInputByFormat[T]["onProgress"]>[0],
    AnswerValueOfType<T>
  >;
};
type RequiredChecks = {
  [T in CompetitiveQuestionType]: Pick<
    CompetitiveInputByFormat[T],
    "question" | "locked"
  > extends CompetitiveInputByFormat[T]
    ? false
    : true;
};
type CallbackKeys<Props> = {
  [K in keyof Props]-?: Props[K] extends (...args: never[]) => void ? K : never;
}[keyof Props];
type IncompatibleCallbacks<Props> = Omit<Props, CallbackKeys<Props>> & {
  [K in CallbackKeys<Props>]: (value: symbol) => void;
};
type CallbackRejections = {
  [T in CompetitiveQuestionType]: IncompatibleCallbacks<
    CompetitiveInputByFormat[T]
  > extends CompetitiveInputByFormat[T]
    ? false
    : true;
};
type QuestionRejections = {
  [T in CompetitiveQuestionType]: Omit<CompetitiveInputByFormat[T], "question"> & {
    question: Extract<ServerFlashQuestion, { type: Exclude<CompetitiveQuestionType, T> }>;
  } extends CompetitiveInputByFormat[T]
    ? false
    : true;
};
export type CompetitiveInputContractAssertions = [
  Assert<Equal<keyof CompetitiveInputByFormat, CompetitiveQuestionType>>,
  Assert<AllTrue<QuestionChecks[CompetitiveQuestionType]>>,
  Assert<AllTrue<KeyChecks[CompetitiveQuestionType]>>,
  Assert<AllTrue<UnionChecks[CompetitiveQuestionType]>>,
  Assert<AllTrue<AnswerChecks[AnswerFormats]>>,
  Assert<AllTrue<ProgressChecks[ProgressFormats]>>,
  Assert<AllTrue<RequiredChecks[CompetitiveQuestionType]>>,
  Assert<AllTrue<CallbackRejections[CompetitiveQuestionType]>>,
  Assert<AllTrue<QuestionRejections[CompetitiveQuestionType]>>,
  Assert<Equal<MiniWordleCompetitiveInputProps, CompetitiveInputByFormat["mini-wordle"]>>,
  Assert<
    {
      context: "competitive";
      format: "true-false";
      props: CompetitiveInputByFormat["anagram"];
    } extends CompetitiveInput
      ? false
      : true
  >,
  Assert<
    {
      question: CompetitiveInputByFormat["true-false"]["question"];
      locked: boolean;
      onSubmit: (value: string) => void;
    } extends CompetitiveInputByFormat["true-false"]
      ? false
      : true
  >,
];
