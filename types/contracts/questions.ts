import type * as Legacy from "@/types/question";
import type { QuestionTagSet, QuestionVersion } from "@/types/domain/content";
import type { QuestionDefinitionId, QuestionVersionId } from "@/types/domain/identifiers";
import type { DurationMs } from "@/types/domain/values";

export type QuestionType = Legacy.QuestionType;

type PublicQuestionBase<Type extends QuestionType> = {
  readonly id: QuestionVersionId;
  readonly type: Type;
  readonly category: string;
  readonly tags: QuestionTagSet;
  readonly prompt: string;
  readonly context: string | null;
  readonly timeLimitMs: DurationMs;
};

type QuestionSolutionBase<Type extends QuestionType> = {
  readonly questionVersionId: QuestionVersionId;
  readonly type: Type;
  readonly explanation: string;
};

type QuestionRevealBase<Type extends QuestionType> = {
  readonly questionVersionId: QuestionVersionId;
  readonly type: Type;
};

type PublicMatchingItem = Legacy.MatchingItem;
type PublicMatchingLeftItem = Omit<Legacy.MatchingLeftItem, "correctMatchId">;
type PublicClassificationItem = Omit<Legacy.ClassificationItem, "correctCategory">;
type PublicFlashMemoryItem = Omit<Legacy.FlashMemoryItem, "correctPosition">;
type PublicMemoryTile = Pick<Legacy.MemoryPairsTile, "id">;
type RevealedMemoryTile = Omit<Legacy.MemoryPairsTile, "pairId">;
type PublicImageLabelAnchor = Omit<Legacy.ImageLabelAnchor, "correctLabelId">;
type PublicWordSearchTarget = Pick<Legacy.WordSearchTarget, "id" | "word">;

type PublicImageLabelingPayload =
  | {
      readonly task: "assign-all";
      readonly surface: Legacy.ImageSurface;
      readonly anchors: readonly PublicImageLabelAnchor[];
      readonly labels: readonly Legacy.ImageLabelOption[];
    }
  | {
      readonly task: "identify-one";
      readonly surface: Legacy.ImageSurface;
      readonly target: Legacy.NormalizedPoint;
      readonly response:
        | { readonly kind: "choice"; readonly options: readonly string[] }
        | { readonly kind: "text" };
    };

type ImageLabelingSolutionPayload =
  | {
      readonly task: "assign-all";
      readonly labelsByAnchorId: Readonly<Record<string, string>>;
    }
  | {
      readonly task: "identify-one";
      readonly correctAnswer: string;
      readonly acceptedAnswers: readonly string[];
    };

export type QuestionContractMap = {
  readonly "multiple-choice": {
    readonly public: {
      readonly options: readonly string[];
      readonly media: Legacy.QuestionMedia | null;
      readonly promptVisual: Legacy.MultipleChoicePromptVisual | null;
    };
    readonly solution: { readonly correctAnswer: string };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly "odd-one-out": {
    readonly public: { readonly items: readonly Legacy.OddOneOutItem[] };
    readonly solution: { readonly correctAnswer: string };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly matching: {
    readonly public: {
      readonly leftItems: readonly PublicMatchingLeftItem[];
      readonly rightItems: readonly PublicMatchingItem[];
    };
    readonly solution: { readonly matches: Readonly<Record<string, string>> };
    readonly answer: Legacy.MatchingAnswer;
    readonly reveal: never;
  };
  readonly "connect-pairs": {
    readonly public: {
      readonly grid: { readonly rows: 5; readonly columns: 5 };
      readonly pairs: readonly Legacy.ConnectPairsPair[];
      readonly requireFullCoverage: true;
    };
    readonly solution: { readonly paths: Readonly<Record<string, readonly number[]>> };
    readonly answer: Legacy.ConnectPairsAnswer;
    readonly reveal: never;
  };
  readonly "true-false": {
    readonly public: null;
    readonly solution: { readonly correctAnswer: boolean };
    readonly answer: boolean;
    readonly reveal: never;
  };
  readonly "short-text": {
    readonly public: null;
    readonly solution: {
      readonly correctAnswer: string;
      readonly acceptedAnswers: readonly string[];
    };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly "progressive-clues": {
    readonly public: { readonly clueCount: number; readonly cluePenalty: number };
    readonly solution: {
      readonly correctAnswer: string;
      readonly acceptedAnswers: readonly string[];
    };
    readonly answer: string;
    readonly reveal: { readonly clueIndex: number; readonly clue: string };
  };
  readonly "progressive-image": {
    readonly public: {
      readonly surface: Omit<Legacy.ImageSurface, "src">;
      readonly revealDurationMs: DurationMs;
      readonly answerLabel: string | null;
      readonly answerPlaceholder: string | null;
    };
    readonly solution: {
      readonly correctAnswer: string;
      readonly acceptedAnswers: readonly string[];
      readonly solutionAlt: string;
    };
    readonly answer: string;
    readonly reveal: { readonly surface: Legacy.ImageSurface };
  };
  readonly "heat-map": {
    readonly public: {
      readonly surface: Legacy.ImageSurface;
      readonly targetLabel: string;
    };
    readonly solution: {
      readonly target: Legacy.NormalizedPoint;
      readonly fullCreditRadius: number;
      readonly toleranceRadius: number;
    };
    readonly answer: Legacy.HeatMapAnswer;
    readonly reveal: never;
  };
  readonly "image-labeling": {
    readonly public: PublicImageLabelingPayload;
    readonly solution: ImageLabelingSolutionPayload;
    readonly answer: Legacy.ImageLabelingAnswer | string;
    readonly reveal: never;
  };
  readonly ordering: {
    readonly public: {
      readonly items: readonly string[];
      readonly directionLabels: { readonly start: string; readonly end: string } | null;
    };
    readonly solution: { readonly correctOrder: readonly string[] };
    readonly answer: readonly string[];
    readonly reveal: never;
  };
  readonly classification: {
    readonly public: {
      readonly items: readonly PublicClassificationItem[];
      readonly categories: readonly string[];
    };
    readonly solution: { readonly categoriesByItem: Readonly<Record<string, string>> };
    readonly answer: Legacy.ClassificationAnswer;
    readonly reveal: never;
  };
  readonly "flash-memory": {
    readonly public: {
      readonly revealDurationMs: DurationMs;
      readonly grid: { readonly rows: number; readonly columns: number };
      readonly items: readonly PublicFlashMemoryItem[];
    };
    readonly solution: { readonly positionsByItemId: Readonly<Record<string, number>> };
    readonly answer: Legacy.FlashMemoryAnswer;
    readonly reveal: { readonly items: readonly Legacy.FlashMemoryItem[] };
  };
  readonly "memory-pairs": {
    readonly public: {
      readonly grid: { readonly rows: number; readonly columns: number };
      readonly tiles: readonly PublicMemoryTile[];
      readonly mismatchRevealDurationMs: DurationMs | null;
    };
    readonly solution: { readonly pairByTileId: Readonly<Record<string, string>> };
    readonly answer: Legacy.MemoryPairsAnswer;
    readonly reveal: { readonly tile: RevealedMemoryTile };
  };
  readonly "simon-sequence": {
    readonly public: { readonly pads: readonly Legacy.SimonSequencePad[] };
    readonly solution: { readonly sequence: readonly string[] };
    readonly answer: readonly string[];
    readonly reveal: { readonly sequence: readonly string[] };
  };
  readonly "logic-matrix": {
    readonly public: {
      readonly pieces: readonly Legacy.LogicMatrixPiece[];
      readonly cells: readonly (string | null)[];
      readonly optionIds: readonly string[];
      readonly showPieceLabels: boolean | null;
    };
    readonly solution: { readonly correctOptionId: string };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly "mini-sudoku": {
    readonly public: { readonly grid: readonly (number | null)[] };
    readonly solution: { readonly solution: readonly number[] };
    readonly answer: Legacy.MiniSudokuAnswer;
    readonly reveal: never;
  };
  readonly "mini-nonogram": {
    readonly public: {
      readonly rowClues: readonly (readonly number[])[];
      readonly columnClues: readonly (readonly number[])[];
    };
    readonly solution: { readonly solution: readonly boolean[] };
    readonly answer: Legacy.MiniNonogramAnswer;
    readonly reveal: never;
  };
  readonly queens: {
    readonly public: {
      readonly grid: { readonly rows: 5; readonly columns: 5 };
      readonly regions: readonly number[];
      readonly prefilledQueens: readonly number[];
    };
    readonly solution: { readonly solution: readonly number[] };
    readonly answer: Legacy.QueensAnswer;
    readonly reveal: never;
  };
  readonly "time-maze": {
    readonly public: {
      readonly grid: { readonly rows: number; readonly columns: number };
      readonly cells: readonly Legacy.MazeCell[];
    };
    readonly solution: null;
    readonly answer: Legacy.TimeMazeAnswer;
    readonly reveal: never;
  };
  readonly zip: {
    readonly public: {
      readonly grid: { readonly rows: 5; readonly columns: 5 };
      readonly checkpoints: readonly Legacy.ZipCheckpoint[];
      readonly instruction: string | null;
      readonly mapNote: string | null;
      readonly boardLabel: string | null;
    };
    readonly solution: { readonly solution: readonly number[] };
    readonly answer: Legacy.ZipAnswer;
    readonly reveal: never;
  };
  readonly pipes: {
    readonly public: {
      readonly grid: { readonly rows: 5; readonly columns: 5 };
      readonly tiles: readonly Legacy.PipesTileKind[];
      readonly initialRotations: readonly number[];
      readonly source: number;
    };
    readonly solution: { readonly solutionRotations: readonly number[] };
    readonly answer: Legacy.PipesAnswer;
    readonly reveal: never;
  };
  readonly "sliding-puzzle": {
    readonly public: { readonly initialTiles: readonly (number | null)[] };
    readonly solution: { readonly solution: readonly (number | null)[] };
    readonly answer: Legacy.SlidingPuzzleAnswer;
    readonly reveal: never;
  };
  readonly escape: {
    readonly public: {
      readonly grid: Legacy.EscapeQuestion["grid"];
      readonly initialBlocks: readonly Legacy.EscapeBlock[];
      readonly instruction: string | null;
      readonly hideInstruction: boolean;
      readonly objectiveLabel: string | null;
      readonly hideObjectiveLabel: boolean;
      readonly completionMessage: string | null;
      readonly boardLabel: string | null;
    };
    readonly solution: {
      readonly referenceSolution: readonly Legacy.EscapeMove[];
      readonly optimalMoves: number;
    };
    readonly answer: Legacy.EscapeAnswer;
    readonly reveal: never;
  };
  readonly "error-reconstruction": {
    readonly public: {
      readonly steps: readonly Legacy.ErrorReconstructionStep[];
      readonly correctionOptions: readonly string[];
      readonly instruction: string | null;
      readonly correctionLabel: string | null;
      readonly correctionRequired: boolean;
      readonly submitLabel: string | null;
    };
    readonly solution: {
      readonly firstErrorStepId: string;
      readonly correctCorrection: string | null;
    };
    readonly answer: Legacy.ErrorReconstructionAnswer;
    readonly reveal: never;
  };
  readonly anagram: {
    readonly public: {
      readonly tiles: readonly Legacy.AnagramTile[];
      readonly hint: string | null;
    };
    readonly solution: { readonly correctAnswer: string };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly "word-hashtag": {
    readonly public: {
      readonly grid: { readonly rows: 5; readonly columns: 5 };
      readonly initialLetters: readonly (string | null)[];
      readonly maxMoves: number;
    };
    readonly solution: { readonly words: Legacy.WordHashtagWords };
    readonly answer: Legacy.WordHashtagAnswer;
    readonly reveal: never;
  };
  readonly "word-search": {
    readonly public: {
      readonly grid: { readonly rows: number; readonly columns: number };
      readonly letters: readonly string[];
      readonly targets: readonly PublicWordSearchTarget[];
    };
    readonly solution: {
      readonly positionsByTargetId: Readonly<
        Record<string, { readonly startCell: number; readonly endCell: number }>
      >;
    };
    readonly answer: Legacy.WordSearchAnswer;
    readonly reveal: never;
  };
  readonly "mini-wordle": {
    readonly public: {
      readonly hint: string | null;
      readonly wordLength: 4 | 5;
      readonly maxAttempts: number;
    };
    readonly solution: {
      readonly correctAnswer: string;
      readonly additionalGuesses: readonly string[];
    };
    readonly answer: Legacy.MiniWordleAnswer;
    readonly reveal: never;
  };
  readonly "logic-code": {
    readonly public: {
      readonly clues: readonly Legacy.LogicCodeClue[];
      readonly codeLength: number;
    };
    readonly solution: { readonly correctAnswer: string };
    readonly answer: string;
    readonly reveal: never;
  };
  readonly estimation: {
    readonly public: {
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly initialValue: number;
      readonly unit: string;
      readonly media: Legacy.QuestionMedia | null;
    };
    readonly solution: { readonly correctAnswer: number; readonly tolerance: number };
    readonly answer: number;
    readonly reveal: never;
  };
};

export type PublicQuestionOfType<Type extends QuestionType> = PublicQuestionBase<Type> & {
  readonly payload: QuestionContractMap[Type]["public"];
};

export type PublicQuestion = {
  [Type in QuestionType]: PublicQuestionOfType<Type>;
}[QuestionType];

export type QuestionSolutionOfType<Type extends QuestionType> = QuestionSolutionBase<Type> & {
  readonly payload: QuestionContractMap[Type]["solution"];
};

export type QuestionSolution = {
  [Type in QuestionType]: QuestionSolutionOfType<Type>;
}[QuestionType];

type QuestionTypeWithReveal = {
  [Type in QuestionType]: QuestionContractMap[Type]["reveal"] extends never ? never : Type;
}[QuestionType];

export type QuestionRevealOfType<Type extends QuestionTypeWithReveal> = QuestionRevealBase<Type> & {
  readonly payload: QuestionContractMap[Type]["reveal"];
};

export type QuestionReveal = {
  [Type in QuestionTypeWithReveal]: QuestionRevealOfType<Type>;
}[QuestionTypeWithReveal];

export type AnswerValueOfType<Type extends QuestionType> = QuestionContractMap[Type]["answer"];
export type AnswerValue = QuestionContractMap[QuestionType]["answer"];

export type AuthoringQuestionOfType<Type extends QuestionType> = {
  readonly questionDefinitionId: QuestionDefinitionId;
  readonly public: PublicQuestionOfType<Type>;
  readonly solution: QuestionSolutionOfType<Type>;
  readonly reveals: readonly (QuestionContractMap[Type]["reveal"] extends never
    ? never
    : QuestionRevealOfType<Extract<Type, QuestionTypeWithReveal>>)[];
};

export type AuthoringQuestion = {
  [Type in QuestionType]: AuthoringQuestionOfType<Type>;
}[QuestionType];

export type TypedQuestionVersion<Type extends QuestionType = QuestionType> = QuestionVersion<
  Type,
  QuestionContractMap[Type]["public"],
  QuestionContractMap[Type]["solution"]
>;
