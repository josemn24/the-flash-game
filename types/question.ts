import type { QuestionTags } from "@/lib/questionTags";

export type QuestionIllustration = "japan-flag" | "saturn" | "italy-flag" | "france-flag";

export type QuestionVariant = "default" | "flash-pop";

export type QuestionMedia =
  | {
      type: "illustration";
      id: QuestionIllustration;
      alt: string;
    }
  | {
      type: "image";
      src: string;
      alt: string;
      fit?: "cover" | "contain";
      position?: string;
    };

export type BaseQuestion = {
  id: string;
  category: string;
  tags: QuestionTags;
  question: string;
  questionContext?: string;
  timeLimit: number;
  points: number;
  explanation: string;
};

export type NumberSequencePromptVisual = {
  type: "number-sequence";
  eyebrow?: string;
  sequence: string[];
  differences?: string[];
};

export type MultipleChoicePromptVisual = NumberSequencePromptVisual;

export type MultipleChoiceQuestion = BaseQuestion & {
  type: "multiple-choice";
  options: string[];
  correctAnswer: string;
  media?: QuestionMedia;
  promptVisual?: MultipleChoicePromptVisual;
};

export type OddOneOutItem = {
  id: string;
  label: string;
  media?: QuestionMedia;
};

export type OddOneOutQuestion = BaseQuestion & {
  type: "odd-one-out";
  items: OddOneOutItem[];
  correctAnswer: string;
};

export type MatchingItem = {
  id: string;
  label: string;
  icon?: string;
  media?: QuestionMedia;
};

export type MatchingLeftItem = MatchingItem & {
  correctMatchId: string;
};

export type MatchingQuestion = BaseQuestion & {
  type: "matching";
  leftItems: MatchingLeftItem[];
  rightItems: MatchingItem[];
};

export type ConnectPairsPair = {
  id: string;
  label: string;
  symbol: string;
  endpoints: [number, number];
  color?: string;
};

export type ConnectPairsQuestion = BaseQuestion & {
  type: "connect-pairs";
  grid: { rows: 5; columns: 5 };
  pairs: ConnectPairsPair[];
  solutionPaths: Record<string, number[]>;
  requireFullCoverage: true;
};

export type TrueFalseQuestion = BaseQuestion & {
  type: "true-false";
  correctAnswer: boolean;
};

export type ShortTextQuestion = BaseQuestion & {
  type: "short-text";
  correctAnswer: string;
  acceptedAnswers?: string[];
};

export type ProgressiveCluesQuestion = BaseQuestion & {
  type: "progressive-clues";
  clues: string[];
  cluePenalty: number;
  correctAnswer: string;
  acceptedAnswers?: string[];
};

export type ProgressiveImageQuestion = BaseQuestion & {
  type: "progressive-image";
  surface: ImageSurface;
  solutionAlt: string;
  revealDuration: number;
  correctAnswer: string;
  acceptedAnswers?: string[];
  answerLabel?: string;
  answerPlaceholder?: string;
};

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type ImageSurface = {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit?: "cover" | "contain";
  position?: string;
};

export type HeatMapAnswer = NormalizedPoint;

export type HeatMapQuestion = BaseQuestion & {
  type: "heat-map";
  surface: ImageSurface;
  target: NormalizedPoint;
  targetLabel: string;
  fullCreditRadius: number;
  toleranceRadius: number;
};

export type ImageLabelOption = {
  id: string;
  label: string;
};

export type ImageLabelAnchor = {
  id: string;
  point: NormalizedPoint;
  correctLabelId: string;
};

export type ImageLabelingAnswer = Record<string, string>;

type ImageLabelingBaseQuestion = BaseQuestion & {
  type: "image-labeling";
  surface: ImageSurface;
};

export type AssignAllImageLabelingQuestion = ImageLabelingBaseQuestion & {
  task: "assign-all";
  anchors: ImageLabelAnchor[];
  labels: ImageLabelOption[];
};

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

export type IdentifyOneImageLabelingQuestion = ImageLabelingBaseQuestion & {
  task: "identify-one";
  target: NormalizedPoint;
  response: ImageLabelingChoiceResponse | ImageLabelingTextResponse;
};

export type ImageLabelingQuestion =
  AssignAllImageLabelingQuestion | IdentifyOneImageLabelingQuestion;

export type LogicCodeClue = {
  code: string;
  hint: string;
};

export type LogicCodeQuestion = BaseQuestion & {
  type: "logic-code";
  clues: LogicCodeClue[];
  codeLength: number;
  correctAnswer: string;
};

export type EstimationQuestion = BaseQuestion & {
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

export type OrderingQuestion = BaseQuestion & {
  type: "ordering";
  items: string[];
  correctOrder: string[];
  directionLabels?: {
    start: string;
    end: string;
  };
};

export type ClassificationItem = {
  label: string;
  correctCategory: string;
};

export type ClassificationQuestion = BaseQuestion & {
  type: "classification";
  items: ClassificationItem[];
  categories: string[];
};

export type FlashMemoryItem = {
  id: string;
  label: string;
  media?: QuestionMedia;
  correctPosition: number;
};

export type FlashMemoryQuestion = BaseQuestion & {
  type: "flash-memory";
  revealDuration: number;
  grid: { rows: number; columns: number };
  items: FlashMemoryItem[];
};

export type MemoryPairsTile = {
  id: string;
  pairId: string;
  label: string;
  symbol?: string;
  media?: QuestionMedia;
};

export type MemoryPairsQuestion = BaseQuestion & {
  type: "memory-pairs";
  grid: { rows: number; columns: number };
  tiles: MemoryPairsTile[];
  mismatchRevealDuration?: number;
};

export type SimonSequencePad = {
  id: string;
  label: string;
};

export type SimonSequenceQuestion = BaseQuestion & {
  type: "simon-sequence";
  pads: SimonSequencePad[];
  sequence: string[];
};

export type LogicMatrixPiece = {
  id: string;
  symbol: string;
  label: string;
};

export type LogicMatrixQuestion = BaseQuestion & {
  type: "logic-matrix";
  pieces: LogicMatrixPiece[];
  cells: Array<string | null>;
  optionIds: string[];
  correctOptionId: string;
  showPieceLabels?: boolean;
};

export type MiniSudokuQuestion = BaseQuestion & {
  type: "mini-sudoku";
  grid: Array<number | null>;
  solution: number[];
};

export type MiniNonogramQuestion = BaseQuestion & {
  type: "mini-nonogram";
  solution: boolean[];
  rowClues: number[][];
  columnClues: number[][];
};

export type QueensQuestion = BaseQuestion & {
  type: "queens";
  grid: { rows: 5; columns: 5 };
  regions: number[];
  prefilledQueens?: number[];
  solution: number[];
};

export type MazeCell = "wall" | "path" | "start" | "exit";

export type TimeMazeQuestion = BaseQuestion & {
  type: "time-maze";
  grid: { rows: number; columns: number };
  cells: MazeCell[];
};

export type ZipCheckpoint = {
  value: number;
  cell: number;
  label?: string;
};

export type ZipQuestion = BaseQuestion & {
  type: "zip";
  grid: { rows: 5; columns: 5 };
  checkpoints: ZipCheckpoint[];
  solution: number[];
  instruction?: string;
  mapNote?: string;
  boardLabel?: string;
};

export type PipesTileKind = "end" | "straight" | "corner" | "tee";

export type PipesQuestion = BaseQuestion & {
  type: "pipes";
  grid: { rows: 5; columns: 5 };
  tiles: PipesTileKind[];
  initialRotations: number[];
  solutionRotations: number[];
  source: number;
};

export type SlidingPuzzleQuestion = BaseQuestion & {
  type: "sliding-puzzle";
  initialTiles: Array<number | null>;
  solution: Array<number | null>;
};

export type EscapeBlock = {
  id: string;
  kind: "target" | "obstacle";
  orientation: "horizontal" | "vertical";
  row: number;
  column: number;
  length: 2 | 3;
  label?: string;
  symbol?: string;
};

export type EscapeMove = {
  blockId: string;
  from: number;
  to: number;
};

export type EscapeQuestion = BaseQuestion & {
  type: "escape";
  grid: {
    rows: 6;
    columns: 6;
    exit: { side: "right"; row: number };
  };
  initialBlocks: EscapeBlock[];
  referenceSolution: EscapeMove[];
  optimalMoves: number;
  instruction?: string;
  objectiveLabel?: string;
  completionMessage?: string;
  boardLabel?: string;
};

export type ErrorReconstructionStep = {
  id: string;
  text: string;
};

export type ErrorReconstructionCorrection = {
  options: string[];
  correctAnswer: string;
};

export type ErrorReconstructionQuestion = BaseQuestion & {
  type: "error-reconstruction";
  steps: ErrorReconstructionStep[];
  firstErrorStepId: string;
  correction?: ErrorReconstructionCorrection;
  instruction?: string;
  correctionLabel?: string;
  correctionRequired?: boolean;
  submitLabel?: string;
};

export type AnagramTile = {
  id: string;
  value: string;
};

export type AnagramQuestion = BaseQuestion & {
  type: "anagram";
  tiles: AnagramTile[];
  correctAnswer: string;
  hint?: string;
};

export type WordHashtagWords = {
  top: string;
  bottom: string;
  left: string;
  right: string;
};

export type WordHashtagSwap = {
  fromCell: number;
  toCell: number;
};

export type WordHashtagQuestion = BaseQuestion & {
  type: "word-hashtag";
  grid: { rows: 5; columns: 5 };
  words: WordHashtagWords;
  initialLetters: Array<string | null>;
  maxMoves: number;
};

export type WordSearchTarget = {
  id: string;
  word: string;
  startCell: number;
  endCell: number;
};

export type WordSearchQuestion = BaseQuestion & {
  type: "word-search";
  grid: { rows: number; columns: number };
  letters: string[];
  targets: WordSearchTarget[];
};

export type MiniWordleQuestion = BaseQuestion & {
  type: "mini-wordle";
  correctAnswer: string;
  additionalGuesses?: string[];
  hint?: string;
  wordLength?: 4 | 5;
  maxAttempts?: number;
};

export type Question =
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

export type QuestionType = Question["type"];
export type QuestionOfType<T extends QuestionType> = Extract<Question, { type: T }>;

export type ClassificationAnswer = Record<string, string>;
export type MatchingAnswer = Record<string, string>;
export type ConnectPairsAnswer = { paths: Record<string, number[]> };
export type FlashMemoryAnswer = Record<string, string>;
export type MemoryPairsAnswer = { attempts: Array<[string, string]> };
export type SimonSequenceAnswer = string[];
export type MiniSudokuAnswer = Record<string, number>;
export type MiniNonogramAnswer = Record<string, true>;
export type QueensAnswer = { queens: number[]; marks: number[] };
export type TimeMazeAnswer = { path: number[] };
export type ZipAnswer = { path: number[] };
export type PipesAnswer = { rotations: number[]; moves: number };
export type SlidingPuzzleAnswer = { tiles: Array<number | null>; moves: number };
export type EscapeAnswer = { moves: EscapeMove[] };
export type ErrorReconstructionAnswer = { stepId: string; correction?: string | null };
export type WordHashtagAnswer = { swaps: WordHashtagSwap[] };
export type WordSearchAnswer = { foundWordIds: string[] };
export type MiniWordleAnswer = { guesses: string[] };
export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | ClassificationAnswer
  | MatchingAnswer
  | ConnectPairsAnswer
  | FlashMemoryAnswer
  | MemoryPairsAnswer
  | MiniSudokuAnswer
  | MiniNonogramAnswer
  | QueensAnswer
  | TimeMazeAnswer
  | ZipAnswer
  | PipesAnswer
  | SlidingPuzzleAnswer
  | EscapeAnswer
  | ErrorReconstructionAnswer
  | WordHashtagAnswer
  | WordSearchAnswer
  | MiniWordleAnswer
  | HeatMapAnswer
  | ImageLabelingAnswer;
