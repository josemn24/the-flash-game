/**
 * Private question projection consumed by the scoring registry.
 *
 * This is deliberately neither `PublicQuestion` nor `PracticeQuestion`: it is
 * the server-only result of composing a public contract with its solution.
 * Practice and competitive adapters may produce this projection, but the
 * scoring registry does not depend on either boundary.
 */
import type * as ContractShapes from "@/types/contracts/question-shapes";
import type { AnswerValue, AnswerValueOfType, QuestionType } from "@/types/contracts";
import type { QuestionTags } from "@/types/domain/tags";

export type { AnswerResult, AnswerResultDetails, AnswerStatus } from "@/types/gameplay/result";
export type { QuestionType } from "@/types/contracts";

export type QuestionMedia = ContractShapes.QuestionMedia;
export type ImageSurface = ContractShapes.ImageSurface;
export type NormalizedPoint = ContractShapes.NormalizedPoint;
export type QueensGrid = ContractShapes.QueensGrid;
export type MazeCell = ContractShapes.MazeCell;
export type PipesTileKind = ContractShapes.PipesTileKind;
export type ZipCheckpoint = ContractShapes.ZipCheckpoint;
export type EscapeBlock = ContractShapes.EscapeBlock;
export type EscapeMove = ContractShapes.EscapeMove;
export type AnagramTile = ContractShapes.AnagramTile;
export type WordHashtagWords = ContractShapes.WordHashtagWords;
export type WordHashtagSwap = ContractShapes.WordHashtagSwap;

export type ImageLabelingChoiceResponse = {
  kind: "choice";
  options: string[];
  correctAnswer: string;
};

export type ImageLabelingTextResponse = {
  kind: "text";
  correctAnswer: string;
  acceptedAnswers?: string[];
};

export type MatchingAnswer = ContractShapes.MatchingAnswer;
export type ConnectPairsAnswer = ContractShapes.ConnectPairsAnswer;
export type HeatMapAnswer = ContractShapes.HeatMapAnswer;
export type ImageLabelingAnswer = ContractShapes.ImageLabelingAnswer;
export type ClassificationAnswer = ContractShapes.ClassificationAnswer;
export type FlashMemoryAnswer = ContractShapes.FlashMemoryAnswer;
export type MemoryPairsAnswer = ContractShapes.MemoryPairsAnswer;
export type SimonSequenceAnswer = string[];
export type MiniSudokuAnswer = ContractShapes.MiniSudokuAnswer;
export type MiniNonogramAnswer = ContractShapes.MiniNonogramAnswer;
export type QueensAnswer = ContractShapes.QueensAnswer;
export type TimeMazeAnswer = ContractShapes.TimeMazeAnswer;
export type ZipAnswer = ContractShapes.ZipAnswer;
export type PipesAnswer = ContractShapes.PipesAnswer;
export type SlidingPuzzleAnswer = ContractShapes.SlidingPuzzleAnswer;
export type EscapeAnswer = ContractShapes.EscapeAnswer;
export type ErrorReconstructionAnswer = ContractShapes.ErrorReconstructionAnswer;
export type WordHashtagAnswer = ContractShapes.WordHashtagAnswer;
export type WordSearchAnswer = ContractShapes.WordSearchAnswer;
export type MiniWordleAnswer = ContractShapes.MiniWordleAnswer;

export type ResolvedAnswerValue = AnswerValue;
export type ResolvedAnswerValueOfType<Type extends QuestionType> = AnswerValueOfType<Type>;

export type ResolvedBaseQuestion = {
  id: string;
  category: string;
  tags: QuestionTags;
  question: string;
  questionContext?: string;
  timeLimit: number;
  points: number;
  explanation: string;
};

export type MultipleChoiceQuestion = ResolvedBaseQuestion & {
  type: "multiple-choice";
  options: string[];
  correctAnswer: string;
  media?: QuestionMedia;
  promptVisual?: ContractShapes.MultipleChoicePromptVisual;
};

export type OddOneOutQuestion = ResolvedBaseQuestion & {
  type: "odd-one-out";
  items: Array<ContractShapes.OddOneOutItem>;
  correctAnswer: string;
};

export type MatchingQuestion = ResolvedBaseQuestion & {
  type: "matching";
  leftItems: Array<ContractShapes.MatchingLeftItem>;
  rightItems: Array<ContractShapes.MatchingItem>;
};

export type ConnectPairsQuestion = ResolvedBaseQuestion & {
  type: "connect-pairs";
  grid: { rows: 5; columns: 5 };
  pairs: Array<ContractShapes.ConnectPairsPair>;
  solutionPaths: Record<string, number[]>;
  requireFullCoverage: true;
};

export type TrueFalseQuestion = ResolvedBaseQuestion & {
  type: "true-false";
  correctAnswer: boolean;
};

export type ShortTextQuestion = ResolvedBaseQuestion & {
  type: "short-text";
  correctAnswer: string;
  acceptedAnswers?: string[];
};

export type ProgressiveCluesQuestion = ResolvedBaseQuestion & {
  type: "progressive-clues";
  clues: string[];
  cluePenalty: number;
  correctAnswer: string;
  acceptedAnswers?: string[];
};

export type ProgressiveImageQuestion = ResolvedBaseQuestion & {
  type: "progressive-image";
  surface: ImageSurface;
  solutionAlt: string;
  revealDuration: number;
  correctAnswer: string;
  acceptedAnswers?: string[];
  answerLabel?: string;
  answerPlaceholder?: string;
};

export type HeatMapQuestion = ResolvedBaseQuestion & {
  type: "heat-map";
  surface: ImageSurface;
  target: NormalizedPoint;
  targetLabel: string;
  fullCreditRadius: number;
  toleranceRadius: number;
};

export type AssignAllImageLabelingQuestion = ResolvedBaseQuestion & {
  type: "image-labeling";
  task: "assign-all";
  surface: ImageSurface;
  anchors: Array<ContractShapes.ImageLabelAnchor>;
  labels: Array<ContractShapes.ImageLabelOption>;
};

export type IdentifyOneImageLabelingQuestion = ResolvedBaseQuestion & {
  type: "image-labeling";
  task: "identify-one";
  surface: ImageSurface;
  target: NormalizedPoint;
  response: ImageLabelingChoiceResponse | ImageLabelingTextResponse;
};

export type ImageLabelingQuestion =
  AssignAllImageLabelingQuestion | IdentifyOneImageLabelingQuestion;

export type OrderingQuestion = ResolvedBaseQuestion & {
  type: "ordering";
  items: string[];
  correctOrder: string[];
  directionLabels?: { start: string; end: string };
};

export type ClassificationQuestion = ResolvedBaseQuestion & {
  type: "classification";
  items: Array<ContractShapes.ClassificationItem>;
  categories: string[];
};

export type FlashMemoryQuestion = ResolvedBaseQuestion & {
  type: "flash-memory";
  revealDuration: number;
  grid: { rows: number; columns: number };
  items: Array<ContractShapes.FlashMemoryItem>;
};

export type MemoryPairsQuestion = ResolvedBaseQuestion & {
  type: "memory-pairs";
  grid: { rows: number; columns: number };
  tiles: Array<ContractShapes.MemoryPairsTile>;
  mismatchRevealDuration?: number;
};

export type SimonSequenceQuestion = ResolvedBaseQuestion & {
  type: "simon-sequence";
  pads: Array<ContractShapes.SimonSequencePad>;
  sequence: string[];
};

export type LogicMatrixQuestion = ResolvedBaseQuestion & {
  type: "logic-matrix";
  pieces: Array<ContractShapes.LogicMatrixPiece>;
  cells: Array<string | null>;
  optionIds: string[];
  correctOptionId: string;
  showPieceLabels?: boolean;
};

export type MiniSudokuQuestion = ResolvedBaseQuestion & {
  type: "mini-sudoku";
  grid: Array<number | null>;
  solution: number[];
};

export type MiniNonogramQuestion = ResolvedBaseQuestion & {
  type: "mini-nonogram";
  solution: boolean[];
  rowClues: number[][];
  columnClues: number[][];
};

export type QueensQuestion = ResolvedBaseQuestion & {
  type: "queens";
  grid: QueensGrid;
  regions: number[];
  prefilledQueens?: number[];
  solution: number[];
};

export type TimeMazeQuestion = ResolvedBaseQuestion & {
  type: "time-maze";
  grid: { rows: number; columns: number };
  cells: MazeCell[];
};

export type ZipQuestion = ResolvedBaseQuestion & {
  type: "zip";
  grid: { rows: 5; columns: 5 };
  checkpoints: readonly ZipCheckpoint[];
  solution: number[];
  instruction?: string;
  mapNote?: string;
  boardLabel?: string;
};

export type PipesQuestion = ResolvedBaseQuestion & {
  type: "pipes";
  grid: { rows: 5; columns: 5 };
  tiles: PipesTileKind[];
  initialRotations: number[];
  solutionRotations: number[];
  source: number;
};

export type SlidingPuzzleQuestion = ResolvedBaseQuestion & {
  type: "sliding-puzzle";
  initialTiles: Array<number | null>;
  solution: Array<number | null>;
};

export type EscapeQuestion = ResolvedBaseQuestion & {
  type: "escape";
  grid: {
    rows: 6;
    columns: 6;
    exit: { side: "right"; row: number };
  };
  initialBlocks: Array<EscapeBlock>;
  referenceSolution: Array<EscapeMove>;
  optimalMoves: number;
  instruction?: string;
  hideInstruction?: boolean;
  objectiveLabel?: string;
  hideObjectiveLabel?: boolean;
  completionMessage?: string;
  boardLabel?: string;
};

export type ErrorReconstructionCorrection = {
  options: string[];
  correctAnswer: string;
};

export type ErrorReconstructionQuestion = ResolvedBaseQuestion & {
  type: "error-reconstruction";
  steps: Array<ContractShapes.ErrorReconstructionStep>;
  firstErrorStepId: string;
  correction?: ErrorReconstructionCorrection;
  instruction?: string;
  correctionLabel?: string;
  correctionRequired?: boolean;
  submitLabel?: string;
};

export type AnagramQuestion = ResolvedBaseQuestion & {
  type: "anagram";
  tiles: Array<AnagramTile>;
  correctAnswer: string;
  hint?: string;
};

export type WordHashtagQuestion = ResolvedBaseQuestion & {
  type: "word-hashtag";
  grid: { rows: 5; columns: 5 };
  words: WordHashtagWords;
  initialLetters: Array<string | null>;
  maxMoves: number;
};

export type WordSearchTarget = ContractShapes.WordSearchTarget & {
  startCell: number;
  endCell: number;
};

export type WordSearchQuestion = ResolvedBaseQuestion & {
  type: "word-search";
  grid: { rows: number; columns: number };
  letters: string[];
  targets: Array<WordSearchTarget>;
};

export type MiniWordleQuestion = ResolvedBaseQuestion & {
  type: "mini-wordle";
  correctAnswer: string;
  additionalGuesses?: string[];
  dictionaryId?: "es-general-4.v1" | "es-general-5.v1";
  hint?: string;
  wordLength?: 4 | 5;
  maxAttempts?: number;
};

export type LogicCodeQuestion = ResolvedBaseQuestion & {
  type: "logic-code";
  clues: Array<ContractShapes.LogicCodeClue>;
  codeLength: number;
  correctAnswer: string;
};

export type EstimationQuestion = ResolvedBaseQuestion & {
  type: "estimation";
  correctAnswer: number;
  min: number;
  max: number;
  step: number;
  initialValue: number;
  tolerance: number;
  unit: string;
  media?: QuestionMedia;
};

export type ResolvedQuestion =
  | MultipleChoiceQuestion
  | OddOneOutQuestion
  | MatchingQuestion
  | ConnectPairsQuestion
  | TrueFalseQuestion
  | ShortTextQuestion
  | ProgressiveCluesQuestion
  | ProgressiveImageQuestion
  | HeatMapQuestion
  | ImageLabelingQuestion
  | OrderingQuestion
  | ClassificationQuestion
  | FlashMemoryQuestion
  | MemoryPairsQuestion
  | SimonSequenceQuestion
  | LogicMatrixQuestion
  | MiniSudokuQuestion
  | MiniNonogramQuestion
  | QueensQuestion
  | TimeMazeQuestion
  | ZipQuestion
  | PipesQuestion
  | SlidingPuzzleQuestion
  | EscapeQuestion
  | ErrorReconstructionQuestion
  | AnagramQuestion
  | WordHashtagQuestion
  | WordSearchQuestion
  | MiniWordleQuestion
  | LogicCodeQuestion
  | EstimationQuestion;

export type ResolvedQuestionOfType<Type extends QuestionType> = Extract<
  ResolvedQuestion,
  { type: Type }
>;
