import type { AnswerValue, AnswerValueOfType } from "@/types/contracts";
import type {
  PracticeQuestion,
  PracticeQuestionOfType,
  PracticeQuestionType,
} from "@/types/gameplay/practice";

type Base<T extends PracticeQuestionType> = {
  readonly question: PracticeQuestionOfType<T>;
  readonly locked: boolean;
};
type Answer<T extends PracticeQuestionType> = {
  readonly onSubmit: (answer: AnswerValueOfType<T>) => void;
};
type Progress<T extends PracticeQuestionType> = {
  readonly onProgress: (answer: AnswerValueOfType<T>) => void;
};
type Restored<T extends PracticeQuestionType> = {
  readonly initialAnswer?: AnswerValueOfType<T>;
};
type IncorrectAttempt = { readonly onIncorrectAttempt: () => void };
type TimedResponse = { readonly onTimedResponseStart: () => void };

export type PracticeInputByFormat = {
  readonly "multiple-choice": Base<"multiple-choice"> & Answer<"multiple-choice">;
  readonly "odd-one-out": Base<"odd-one-out"> & Answer<"odd-one-out">;
  readonly matching: Base<"matching"> &
    Answer<"matching"> &
    Progress<"matching"> &
    Restored<"matching"> &
    IncorrectAttempt;
  readonly "connect-pairs": Base<"connect-pairs"> &
    Answer<"connect-pairs"> &
    Progress<"connect-pairs"> &
    Restored<"connect-pairs">;
  readonly "true-false": Base<"true-false"> & Answer<"true-false">;
  readonly "short-text": Base<"short-text"> & Answer<"short-text">;
  readonly "progressive-clues": Base<"progressive-clues"> &
    Answer<"progressive-clues"> &
    Progress<"progressive-clues"> &
    Restored<"progressive-clues"> & {
      readonly onProgressiveClueReveal: (revealedClues: number) => void;
      readonly progressiveCluesRevealed?: number;
    };
  readonly "progressive-image": Base<"progressive-image"> &
    Answer<"progressive-image"> &
    TimedResponse;
  readonly "heat-map": Base<"heat-map"> & Answer<"heat-map">;
  readonly "image-labeling": Base<"image-labeling"> & Answer<"image-labeling">;
  readonly ordering: Base<"ordering"> &
    Answer<"ordering"> &
    Progress<"ordering"> &
    Restored<"ordering">;
  readonly classification: Base<"classification"> &
    Answer<"classification"> &
    Progress<"classification"> &
    Restored<"classification">;
  readonly "flash-memory": Base<"flash-memory"> &
    Answer<"flash-memory"> &
    Progress<"flash-memory"> &
    TimedResponse;
  readonly "memory-pairs": Base<"memory-pairs"> & Answer<"memory-pairs"> & Progress<"memory-pairs">;
  readonly "simon-sequence": Base<"simon-sequence"> & Answer<"simon-sequence"> & TimedResponse;
  readonly "logic-matrix": Base<"logic-matrix"> & Answer<"logic-matrix">;
  readonly "mini-sudoku": Base<"mini-sudoku"> & Answer<"mini-sudoku"> & Progress<"mini-sudoku">;
  readonly "mini-nonogram": Base<"mini-nonogram"> &
    Answer<"mini-nonogram"> &
    Progress<"mini-nonogram">;
  readonly queens: Base<"queens"> &
    Answer<"queens"> &
    Progress<"queens"> &
    Restored<"queens"> &
    IncorrectAttempt;
  readonly "time-maze": Base<"time-maze"> & Answer<"time-maze"> & Progress<"time-maze">;
  readonly "sliding-puzzle": Base<"sliding-puzzle"> & Answer<"sliding-puzzle">;
  readonly escape: Base<"escape"> & Answer<"escape"> & Progress<"escape">;
  readonly "error-reconstruction": Base<"error-reconstruction"> &
    Answer<"error-reconstruction"> &
    Progress<"error-reconstruction"> &
    Restored<"error-reconstruction">;
  readonly anagram: Base<"anagram"> & Answer<"anagram">;
  readonly "word-hashtag": Base<"word-hashtag"> &
    Answer<"word-hashtag"> &
    Progress<"word-hashtag"> &
    Restored<"word-hashtag">;
  readonly "word-search": Base<"word-search"> &
    Answer<"word-search"> &
    Progress<"word-search"> &
    Restored<"word-search"> &
    IncorrectAttempt;
  readonly "mini-wordle": Base<"mini-wordle"> &
    Answer<"mini-wordle"> &
    Progress<"mini-wordle"> &
    Restored<"mini-wordle"> &
    TimedResponse;
  readonly "logic-code": Base<"logic-code"> &
    Progress<"logic-code"> &
    Restored<"logic-code"> & {
      readonly onCodeAttempt: (code: string) => boolean;
      readonly codeAttemptCount?: number;
    };
  readonly estimation: Base<"estimation"> & Answer<"estimation">;
  readonly zip: Base<"zip"> & Answer<"zip"> & Progress<"zip">;
  readonly pipes: Base<"pipes"> & Answer<"pipes"> & Progress<"pipes">;
};

export type PracticeInputProps<T extends PracticeQuestionType> = PracticeInputByFormat[T];
export type PracticeInput = {
  [T in PracticeQuestionType]: {
    readonly context: "practice";
    readonly format: T;
    readonly props: PracticeInputByFormat[T];
  };
}[PracticeQuestionType];

/** Local session projection, consumed only by createPracticeInput. */
export type PracticeInputSource = {
  readonly question: PracticeQuestion | null;
  readonly locked: boolean;
  readonly onSubmit: (answer: AnswerValue) => void;
  readonly onProgress: (answer: AnswerValue) => void;
  readonly onCodeAttempt: (code: string) => boolean;
  readonly onIncorrectAttempt: () => void;
  readonly onProgressiveClueReveal: (revealedClues: number) => void;
  readonly onTimedResponseStart: () => void;
  readonly initialAnswer?: AnswerValue | null;
  readonly codeAttemptCount?: number;
  readonly progressiveCluesRevealed?: number;
};
