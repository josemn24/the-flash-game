import type { AnswerValueOfType } from "@/types/contracts";
import type { PracticeQuestionOfType, PracticeQuestionType } from "@/types/gameplay/practice";
import type { CompetitiveQuestionType } from "@/lib/question-formats/definitions";
import type { CompetitiveInput, CompetitiveInputByFormat } from "./competitiveInputTypes";
import type { PracticeInput, PracticeInputByFormat } from "./practiceInputTypes";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type AllTrue<T> = [T] extends [true] ? true : false;
type ExpectedKeys = {
  "multiple-choice": "question" | "locked" | "onSubmit";
  "odd-one-out": "question" | "locked" | "onSubmit";
  matching:
    "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer" | "onIncorrectAttempt";
  "connect-pairs": "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer";
  "true-false": "question" | "locked" | "onSubmit";
  "short-text": "question" | "locked" | "onSubmit";
  "progressive-clues":
    | "question"
    | "locked"
    | "onSubmit"
    | "onProgress"
    | "initialAnswer"
    | "onProgressiveClueReveal"
    | "progressiveCluesRevealed";
  "progressive-image": "question" | "locked" | "onSubmit" | "onTimedResponseStart";
  "heat-map": "question" | "locked" | "onSubmit";
  "image-labeling": "question" | "locked" | "onSubmit";
  ordering: "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer";
  classification: "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer";
  "flash-memory": "question" | "locked" | "onSubmit" | "onProgress" | "onTimedResponseStart";
  "memory-pairs": "question" | "locked" | "onSubmit" | "onProgress";
  "simon-sequence": "question" | "locked" | "onSubmit" | "onTimedResponseStart";
  "logic-matrix": "question" | "locked" | "onSubmit";
  "mini-sudoku": "question" | "locked" | "onSubmit" | "onProgress";
  "mini-nonogram": "question" | "locked" | "onSubmit" | "onProgress";
  queens:
    "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer" | "onIncorrectAttempt";
  "time-maze": "question" | "locked" | "onSubmit" | "onProgress";
  "sliding-puzzle": "question" | "locked" | "onSubmit";
  escape: "question" | "locked" | "onSubmit" | "onProgress";
  "error-reconstruction": "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer";
  anagram: "question" | "locked" | "onSubmit";
  "word-hashtag": "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer";
  "word-search":
    "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer" | "onIncorrectAttempt";
  "mini-wordle":
    "question" | "locked" | "onSubmit" | "onProgress" | "initialAnswer" | "onTimedResponseStart";
  "logic-code":
    "question" | "locked" | "onProgress" | "initialAnswer" | "onCodeAttempt" | "codeAttemptCount";
  estimation: "question" | "locked" | "onSubmit";
  zip: "question" | "locked" | "onSubmit" | "onProgress";
  pipes: "question" | "locked" | "onSubmit" | "onProgress";
};
type QuestionChecks = {
  [T in PracticeQuestionType]: Equal<
    PracticeInputByFormat[T]["question"],
    PracticeQuestionOfType<T>
  >;
};
type KeyChecks = {
  [T in PracticeQuestionType]: Equal<keyof PracticeInputByFormat[T], ExpectedKeys[T]>;
};
type EnvelopeChecks = {
  [T in PracticeQuestionType]: Equal<
    Extract<PracticeInput, { format: T }>["props"],
    PracticeInputByFormat[T]
  >;
};
type AnswerFormats = Exclude<PracticeQuestionType, "logic-code">;
type AnswerChecks = {
  [T in AnswerFormats]: Equal<
    Parameters<PracticeInputByFormat[T]["onSubmit"]>[0],
    AnswerValueOfType<T>
  >;
};
type ProgressFormats =
  | "classification"
  | "connect-pairs"
  | "error-reconstruction"
  | "escape"
  | "flash-memory"
  | "logic-code"
  | "matching"
  | "memory-pairs"
  | "mini-nonogram"
  | "mini-sudoku"
  | "mini-wordle"
  | "ordering"
  | "pipes"
  | "progressive-clues"
  | "queens"
  | "time-maze"
  | "word-hashtag"
  | "word-search"
  | "zip";
type RestoredFormats =
  | "classification"
  | "connect-pairs"
  | "error-reconstruction"
  | "logic-code"
  | "matching"
  | "mini-wordle"
  | "ordering"
  | "progressive-clues"
  | "queens"
  | "word-hashtag"
  | "word-search";
type ProgressChecks = {
  [T in ProgressFormats]: Equal<
    Parameters<PracticeInputByFormat[T]["onProgress"]>[0],
    AnswerValueOfType<T>
  >;
};
type DraftChecks = {
  [T in RestoredFormats]: Equal<
    PracticeInputByFormat[T]["initialAnswer"],
    AnswerValueOfType<T> | undefined
  >;
};
type CallbackKeys<Props> = {
  [K in keyof Props]-?: Props[K] extends (...args: never[]) => unknown ? K : never;
}[keyof Props];
type MissingOperationChecks = {
  [T in PracticeQuestionType]: {
    [K in CallbackKeys<PracticeInputByFormat[T]>]: Omit<
      PracticeInputByFormat[T],
      K
    > extends PracticeInputByFormat[T]
      ? false
      : true;
  }[CallbackKeys<PracticeInputByFormat[T]>];
};
type CallbackRejections = {
  [T in PracticeQuestionType]: Omit<
    PracticeInputByFormat[T],
    CallbackKeys<PracticeInputByFormat[T]>
  > & {
    [K in CallbackKeys<PracticeInputByFormat[T]>]: (answer: symbol) => void;
  } extends PracticeInputByFormat[T]
    ? false
    : true;
};
type QuestionRejections = {
  [T in PracticeQuestionType]: Omit<PracticeInputByFormat[T], "question"> & {
    question: PracticeQuestionOfType<Exclude<PracticeQuestionType, T>>;
  } extends PracticeInputByFormat[T]
    ? false
    : true;
};
// Test the context independently of whether the two formats' props happen to be structurally compatible.
type CompetitiveContextRejections = {
  [T in CompetitiveQuestionType]: {
    context: "practice";
    format: T;
    props: CompetitiveInputByFormat[T];
  } extends CompetitiveInput
    ? false
    : true;
};
type PracticeContextRejections = {
  [T in CompetitiveQuestionType]: {
    context: "competitive";
    format: T;
    props: PracticeInputByFormat[T];
  } extends PracticeInput
    ? false
    : true;
};
type PracticeToCompetitiveRejections = {
  [T in CompetitiveQuestionType]: Extract<PracticeInput, { format: T }> extends CompetitiveInput
    ? false
    : true;
};
type CompetitiveToPracticeRejections = {
  [T in CompetitiveQuestionType]: Extract<CompetitiveInput, { format: T }> extends PracticeInput
    ? false
    : true;
};

export type PracticeInputContractAssertions = [
  Assert<Equal<keyof PracticeInputByFormat, PracticeQuestionType>>,
  Assert<Equal<PracticeInput["context"], "practice">>,
  Assert<AllTrue<QuestionChecks[PracticeQuestionType]>>,
  Assert<AllTrue<KeyChecks[PracticeQuestionType]>>,
  Assert<AllTrue<EnvelopeChecks[PracticeQuestionType]>>,
  Assert<AllTrue<AnswerChecks[AnswerFormats]>>,
  Assert<AllTrue<ProgressChecks[ProgressFormats]>>,
  Assert<AllTrue<DraftChecks[RestoredFormats]>>,
  Assert<AllTrue<MissingOperationChecks[PracticeQuestionType]>>,
  Assert<AllTrue<CallbackRejections[PracticeQuestionType]>>,
  Assert<AllTrue<QuestionRejections[PracticeQuestionType]>>,
  Assert<AllTrue<CompetitiveContextRejections[CompetitiveQuestionType]>>,
  Assert<AllTrue<PracticeContextRejections[CompetitiveQuestionType]>>,
  Assert<AllTrue<PracticeToCompetitiveRejections[CompetitiveQuestionType]>>,
  Assert<AllTrue<CompetitiveToPracticeRejections[CompetitiveQuestionType]>>,
  Assert<Equal<ReturnType<PracticeInputByFormat["logic-code"]["onCodeAttempt"]>, boolean>>,
  Assert<Equal<PracticeInputByFormat["logic-code"]["codeAttemptCount"], number | undefined>>,
];
