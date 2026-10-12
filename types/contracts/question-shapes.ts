import type { QuestionTagSet } from "@/types/domain/content";

/** Stable discriminators shared by authoring, public payloads and answers. */
export type QuestionType =
  | "multiple-choice"
  | "odd-one-out"
  | "matching"
  | "connect-pairs"
  | "true-false"
  | "short-text"
  | "progressive-clues"
  | "progressive-image"
  | "heat-map"
  | "image-labeling"
  | "ordering"
  | "classification"
  | "flash-memory"
  | "memory-pairs"
  | "simon-sequence"
  | "logic-matrix"
  | "mini-sudoku"
  | "mini-nonogram"
  | "queens"
  | "time-maze"
  | "zip"
  | "pipes"
  | "sliding-puzzle"
  | "escape"
  | "error-reconstruction"
  | "anagram"
  | "word-hashtag"
  | "word-search"
  | "mini-wordle"
  | "logic-code"
  | "estimation";

export type QuestionContractBase = {
  readonly id: string;
  readonly type: QuestionType;
  readonly category: string;
  readonly tags: QuestionTagSet;
  readonly prompt: string;
  readonly context: string | null;
  readonly timeLimitMs: number;
};

export type QuestionIllustrationId = string;

export type QuestionMedia =
  | {
      readonly type: "illustration";
      readonly id: QuestionIllustrationId;
      readonly alt: string;
    }
  | {
      readonly type: "image";
      readonly src: string;
      readonly assetId?: string;
      readonly alt: string;
      readonly width?: number;
      readonly height?: number;
      readonly fit?: "cover" | "contain";
      readonly position?: string;
    };

export type ImageSurface = {
  readonly src: string;
  readonly assetId?: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly fit?: "cover" | "contain";
  readonly position?: string;
};

export type NormalizedPoint = { readonly x: number; readonly y: number };
export type HeatMapAnswer = NormalizedPoint;

export type MultipleChoicePromptVisual = {
  readonly type: "number-sequence";
  readonly eyebrow?: string;
  readonly sequence: readonly string[];
  readonly differences?: readonly string[];
};

export type OddOneOutItem = {
  readonly id: string;
  readonly label: string;
  readonly media?: QuestionMedia;
};

export type MatchingItem = {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly media?: QuestionMedia;
};

export type MatchingLeftItem = MatchingItem & { readonly correctMatchId: string };
export type MatchingAnswer = Record<string, string>;

export type ConnectPairsPair = {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly endpoints: readonly [number, number];
  readonly color?: string;
};
export type ConnectPairsAnswer = { readonly paths: Record<string, number[]> };

export type ImageLabelOption = { readonly id: string; readonly label: string };
export type ImageLabelAnchor = {
  readonly id: string;
  readonly point: NormalizedPoint;
  readonly correctLabelId: string;
};
export type ImageLabelingAnswer = Record<string, string>;

export type ClassificationItem = { readonly label: string; readonly correctCategory: string };
export type ClassificationAnswer = Record<string, string>;

export type FlashMemoryItem = {
  readonly id: string;
  readonly label: string;
  readonly media?: QuestionMedia;
  readonly correctPosition: number;
};
export type FlashMemoryAnswer = Record<string, string>;

export type MemoryPairsTile = {
  readonly id: string;
  readonly pairId: string;
  readonly label: string;
  readonly symbol?: string;
  readonly media?: QuestionMedia;
};
export type MemoryPairsAnswer = { readonly attempts: Array<[string, string]> };

export type SimonSequencePad = { readonly id: string; readonly label: string };
export type LogicMatrixPiece = {
  readonly id: string;
  readonly symbol: string;
  readonly label: string;
};

export type MiniSudokuAnswer = Record<string, number>;
export type MiniNonogramAnswer = Record<string, true>;

export type QueensBoardSize = 4 | 5 | 6 | 7 | 8;
export type QueensGrid = {
  [Size in QueensBoardSize]: { rows: Size; columns: Size };
}[QueensBoardSize];
export type QueensAnswer = { readonly queens: number[]; readonly marks: number[] };

export type MazeCell = "wall" | "path" | "start" | "exit";
export type TimeMazeAnswer = { readonly path: number[] };

export type ZipCheckpoint = {
  readonly value: number;
  readonly cell: number;
  readonly label?: string;
};
export type ZipAnswer = { readonly path: number[] };

export type PipesTileKind = "end" | "straight" | "corner" | "tee";
export type PipesAnswer = { readonly rotations: number[]; readonly moves: number };
export type SlidingPuzzleAnswer = {
  readonly tiles: Array<number | null>;
  readonly moves: number;
};

export type EscapeBlock = {
  readonly id: string;
  readonly kind: "target" | "obstacle";
  readonly orientation: "horizontal" | "vertical";
  readonly row: number;
  readonly column: number;
  readonly length: 2 | 3;
  readonly label?: string;
  readonly symbol?: string;
};
export type EscapeMove = { readonly blockId: string; readonly from: number; readonly to: number };
export type EscapeQuestion = {
  readonly grid: {
    readonly rows: 6;
    readonly columns: 6;
    readonly exit: { readonly side: "right"; readonly row: number };
  };
  readonly initialBlocks: readonly EscapeBlock[];
};
export type EscapeQuestionConfiguration = Pick<EscapeQuestion, "grid" | "initialBlocks">;
export type EscapeAnswer = { readonly moves: EscapeMove[] };

export type ErrorReconstructionStep = { readonly id: string; readonly text: string };
export type ErrorReconstructionAnswer = {
  readonly stepId: string;
  readonly correction?: string | null;
};

export type AnagramTile = { readonly id: string; readonly value: string };

export type WordHashtagWords = {
  readonly top: string;
  readonly bottom: string;
  readonly left: string;
  readonly right: string;
};
export type WordHashtagSwap = { readonly fromCell: number; readonly toCell: number };
export type WordHashtagAnswer = { readonly swaps: WordHashtagSwap[] };

export type WordSearchTarget = {
  readonly id: string;
  readonly word: string;
  readonly startCell?: number;
  readonly endCell?: number;
};
export type WordSearchAnswer = { readonly foundWordIds: string[] };

export type MiniWordleAnswer = { readonly guesses: string[] };
export type LogicCodeClue = { readonly code: string; readonly hint: string };
