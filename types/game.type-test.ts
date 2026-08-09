import type { ChallengeDefinition, Question } from "@/types/game";

type Assert<T extends true> = T;
type IsAssignable<Source, Target> = Source extends Target ? true : false;
type IsNotAssignable<Source, Target> = IsAssignable<Source, Target> extends false ? true : false;
type TestQuestionTags = {
  domains: ["mathematics"];
  topics: ["logic_puzzles"];
  cognitiveSkills: ["logical_reasoning"];
  formatSkills: ["deduction"];
};

type ValidMultipleChoice = {
  id: "valid-choice";
  type: "multiple-choice";
  category: "Test";
  tags: TestQuestionTags;
  question: "Choose one";
  options: ["A", "B"];
  correctAnswer: "A";
  timeLimit: 10;
  points: 100;
  explanation: "A is correct";
};

type MultipleChoiceWithoutOptions = Omit<ValidMultipleChoice, "options">;
type ValidMultipleChoiceWithPromptVisual = ValidMultipleChoice & {
  promptVisual: {
    type: "number-sequence";
    eyebrow: "Pattern";
    sequence: ["1", "2", "__"];
    differences: ["+1", "+2"];
  };
};
type MultipleChoiceWithInvalidPromptVisual = ValidMultipleChoice & {
  promptVisual: {
    type: "text";
    sequence: ["1", "2", "__"];
  };
};
type TrueFalseWithStringAnswer = Omit<ValidMultipleChoice, "type" | "options"> & {
  type: "true-false";
};

type ValidOddOneOut = {
  id: "valid-odd-one-out";
  type: "odd-one-out";
  category: "Test";
  tags: TestQuestionTags;
  question: "Find the odd one out";
  items: [{ id: "a"; label: "A" }, { id: "b"; label: "B" }, { id: "c"; label: "C" }];
  correctAnswer: "c";
  timeLimit: 8;
  points: 100;
  explanation: "C is different";
};

type OddOneOutWithoutLabels = Omit<ValidOddOneOut, "items"> & {
  items: [{ id: "a" }, { id: "b" }, { id: "c" }];
};

type OddOneOutWithNumericAnswer = Omit<ValidOddOneOut, "correctAnswer"> & {
  correctAnswer: 3;
};

type ValidMatching = {
  id: "valid-matching";
  type: "matching";
  category: "Test";
  tags: TestQuestionTags;
  question: "Match each item";
  leftItems: [
    { id: "left-a"; label: "A"; correctMatchId: "right-a" },
    { id: "left-b"; label: "B"; correctMatchId: "right-b" },
    { id: "left-c"; label: "C"; correctMatchId: "right-c" },
  ];
  rightItems: [
    { id: "right-b"; label: "B pair" },
    {
      id: "right-c";
      label: "C pair";
      media: { type: "illustration"; id: "france-flag"; alt: "France flag" };
    },
    { id: "right-a"; label: "A pair" },
  ];
  timeLimit: 20;
  points: 150;
  explanation: "Each item has one pair";
};

type MatchingWithoutReferences = Omit<ValidMatching, "leftItems"> & {
  leftItems: [{ id: "left-a"; label: "A" }];
};

type MatchingWithInvalidMedia = Omit<ValidMatching, "rightItems"> & {
  rightItems: [{ id: "right-a"; label: "A"; media: { type: "video"; src: "/a.mp4" } }];
};

type ValidConnectPairs = {
  id: "valid-connect-pairs";
  type: "connect-pairs";
  category: "Test";
  tags: TestQuestionTags;
  question: "Connect every pair";
  grid: { rows: 5; columns: 5 };
  pairs: [
    { id: "a"; label: "A"; symbol: "A"; endpoints: [0, 4]; color: "#35e8ff" },
    { id: "b"; label: "B"; symbol: "B"; endpoints: [5, 24] },
    { id: "c"; label: "C"; symbol: "C"; endpoints: [6, 19] },
  ];
  solutionPaths: {
    a: [0, 1, 2, 3, 4];
    b: [5, 10, 15, 20, 21, 22, 23, 24];
    c: [6, 7, 8, 9, 14, 13, 12, 11, 16, 17, 18, 19];
  };
  requireFullCoverage: true;
  timeLimit: 35;
  points: 150;
  explanation: "The paths cover the board";
};

type ConnectPairsWithoutSolution = Omit<ValidConnectPairs, "solutionPaths">;
type ConnectPairsWithLooseCoverage = Omit<ValidConnectPairs, "requireFullCoverage"> & {
  requireFullCoverage: false;
};

type ValidProgressiveClues = {
  id: "valid-progressive-clues";
  type: "progressive-clues";
  category: "Test";
  tags: TestQuestionTags;
  question: "Who am I?";
  clues: ["First clue", "Second clue"];
  cluePenalty: 20;
  correctAnswer: "Answer";
  acceptedAnswers: ["Answer", "Alternative"];
  timeLimit: 20;
  points: 100;
  explanation: "The answer is correct";
};

type ProgressiveCluesWithoutClues = Omit<ValidProgressiveClues, "clues">;
type ProgressiveCluesWithoutPenalty = Omit<ValidProgressiveClues, "cluePenalty">;
type ProgressiveCluesWithoutAnswer = Omit<ValidProgressiveClues, "correctAnswer">;

type ValidProgressiveImage = {
  id: "valid-progressive-image";
  type: "progressive-image";
  category: "Test";
  tags: TestQuestionTags;
  question: "What is shown?";
  surface: { src: "/image.png"; alt: "Hidden subject"; width: 800; height: 600 };
  solutionAlt: "The revealed subject";
  revealDuration: 10;
  correctAnswer: "Answer";
  acceptedAnswers: ["Answer", "Alternative"];
  timeLimit: 20;
  points: 100;
  explanation: "The subject is the answer";
};

type ProgressiveImageWithoutSurface = Omit<ValidProgressiveImage, "surface">;
type ProgressiveImageWithoutSolutionAlt = Omit<ValidProgressiveImage, "solutionAlt">;
type ProgressiveImageWithoutRevealDuration = Omit<ValidProgressiveImage, "revealDuration">;
type ProgressiveImageWithoutAnswer = Omit<ValidProgressiveImage, "correctAnswer">;

type ValidTimeMaze = {
  id: "valid-time-maze";
  type: "time-maze";
  category: "Test";
  tags: TestQuestionTags;
  question: "Reach the exit";
  grid: { rows: 5; columns: 5 };
  cells: [
    "start",
    "path",
    "wall",
    "wall",
    "wall",
    "wall",
    "path",
    "wall",
    "wall",
    "wall",
    "wall",
    "path",
    "path",
    "path",
    "wall",
    "wall",
    "wall",
    "wall",
    "path",
    "wall",
    "wall",
    "wall",
    "wall",
    "path",
    "exit",
  ];
  timeLimit: 30;
  points: 100;
  explanation: "The route reaches the exit";
};

type TimeMazeWithoutGrid = Omit<ValidTimeMaze, "grid">;
type TimeMazeWithoutCells = Omit<ValidTimeMaze, "cells">;

type ValidZip = {
  id: "valid-zip";
  type: "zip";
  category: "Test";
  tags: TestQuestionTags;
  question: "Complete the path";
  grid: { rows: 5; columns: 5 };
  checkpoints: [{ value: 1; cell: 0 }, { value: 2; cell: 24 }];
  solution: number[];
  timeLimit: 35;
  points: 150;
  explanation: "The path covers the grid";
};

type ZipWithoutCheckpoints = Omit<ValidZip, "checkpoints">;
type ZipWithoutSolution = Omit<ValidZip, "solution">;
type ZipWithUnsupportedGrid = Omit<ValidZip, "grid"> & {
  grid: { rows: 6; columns: 6 };
};

type ValidQueens = {
  id: "valid-queens";
  type: "queens";
  category: "Test";
  tags: TestQuestionTags;
  question: "Place the crowns";
  grid: { rows: 5; columns: 5 };
  regions: number[];
  solution: number[];
  timeLimit: 60;
  points: 150;
  explanation: "Each crown has a unique place";
};

type QueensWithoutRegions = Omit<ValidQueens, "regions">;
type QueensWithoutSolution = Omit<ValidQueens, "solution">;
type QueensWithUnsupportedGrid = Omit<ValidQueens, "grid"> & {
  grid: { rows: 6; columns: 6 };
};

type ValidHeatMap = {
  id: "valid-heat-map";
  type: "heat-map";
  category: "Test";
  tags: TestQuestionTags;
  question: "Point to the target";
  surface: { src: "/target.svg"; alt: "Target diagram"; width: 600; height: 720 };
  target: { x: 0.5; y: 0.5 };
  targetLabel: "Center";
  fullCreditRadius: 0.1;
  toleranceRadius: 0.25;
  timeLimit: 15;
  points: 100;
  explanation: "The target is in the center";
};

type HeatMapWithoutSurface = Omit<ValidHeatMap, "surface">;
type HeatMapWithoutTarget = Omit<ValidHeatMap, "target">;
type HeatMapWithoutRadii = Omit<ValidHeatMap, "fullCreditRadius" | "toleranceRadius">;

type ValidImageLabeling = {
  id: "valid-image-labeling";
  type: "image-labeling";
  task: "assign-all";
  category: "Test";
  tags: TestQuestionTags;
  question: "Label the image";
  surface: { src: "/diagram.svg"; alt: "Diagram"; width: 600; height: 720 };
  anchors: [{ id: "top"; point: { x: 0.5; y: 0.2 }; correctLabelId: "top-label" }];
  labels: [{ id: "top-label"; label: "Top" }];
  timeLimit: 20;
  points: 100;
  explanation: "The top label belongs at the top";
};

type ValidSingleChoiceImageLabeling = {
  id: "valid-single-choice-image-labeling";
  type: "image-labeling";
  task: "identify-one";
  category: "Test";
  tags: TestQuestionTags;
  question: "Identify the target";
  surface: { src: "/diagram.svg"; alt: "Diagram"; width: 600; height: 720 };
  target: { x: 0.5; y: 0.2 };
  response: { kind: "choice"; options: ["Top", "Bottom"]; correctAnswer: "Top" };
  timeLimit: 12;
  points: 100;
  explanation: "The target is at the top";
};

type ValidSingleTextImageLabeling = Omit<ValidSingleChoiceImageLabeling, "id" | "response"> & {
  id: "valid-single-text-image-labeling";
  response: { kind: "text"; correctAnswer: "Top"; acceptedAnswers: ["Top", "Upper"] };
};

type SingleImageLabelingWithoutTarget = Omit<ValidSingleChoiceImageLabeling, "target">;
type SingleImageLabelingWithoutOptions = Omit<ValidSingleChoiceImageLabeling, "response"> & {
  response: { kind: "choice"; correctAnswer: "Top" };
};
type SingleImageLabelingWithoutAnswer = Omit<ValidSingleTextImageLabeling, "response"> & {
  response: { kind: "text" };
};

type ImageLabelingWithoutSurface = Omit<ValidImageLabeling, "surface">;
type ImageLabelingWithoutAnchors = Omit<ValidImageLabeling, "anchors">;
type ImageLabelingWithoutLabels = Omit<ValidImageLabeling, "labels">;
type ImageLabelingWithoutCorrectReference = Omit<ValidImageLabeling, "anchors"> & {
  anchors: [{ id: "top"; point: { x: 0.5; y: 0.2 } }];
};
type ImageLabelingWithoutTask = Omit<ValidImageLabeling, "task">;

type ValidMemoryPairs = {
  id: "valid-memory-pairs";
  type: "memory-pairs";
  category: "Test";
  tags: TestQuestionTags;
  question: "Find the pairs";
  grid: { rows: 2; columns: 4 };
  tiles: [
    { id: "sun-a"; pairId: "sun"; label: "Sun"; symbol: "☀️" },
    { id: "moon-a"; pairId: "moon"; label: "Moon" },
    { id: "cloud-a"; pairId: "cloud"; label: "Cloud" },
    { id: "bolt-a"; pairId: "bolt"; label: "Bolt" },
    { id: "moon-b"; pairId: "moon"; label: "Moon" },
    { id: "sun-b"; pairId: "sun"; label: "Sun" },
    { id: "bolt-b"; pairId: "bolt"; label: "Bolt" },
    {
      id: "cloud-b";
      pairId: "cloud";
      label: "Cloud";
      media: { type: "illustration"; id: "france-flag"; alt: "Cloud symbol" };
    },
  ];
  mismatchRevealDuration: 0.65;
  timeLimit: 18;
  points: 140;
  explanation: "Each pair appears twice";
};

type MemoryPairsWithoutGrid = Omit<ValidMemoryPairs, "grid">;
type MemoryPairsWithoutTiles = Omit<ValidMemoryPairs, "tiles">;
type MemoryPairsTileWithoutPair = Omit<ValidMemoryPairs, "tiles"> & {
  tiles: [{ id: "sun-a"; label: "Sun" }];
};

type ValidNarrativeChallengeDefinition = {
  id: "narrative-test";
  title: "Narrative";
  subtitle: "Prototype";
  description: "A narrative challenge";
  mode: "narrative";
  implementationStatus: "prototype";
  maxScore: 24;
  prologue: {
    id: "prologue";
    eyebrow: "Prólogo";
    title: "Start";
    blocks: [{ type: "narration"; text: "Opening scene" }];
  };
  beats: [
    {
      id: "movement-one";
      title: "Movement I";
      steps: [
        {
          type: "scene";
          scene: {
            id: "arrival";
            eyebrow: "I";
            blocks: [{ type: "dialogue"; speaker: "Guide"; text: "Scene" }];
          };
        },
        {
          type: "question";
          questionId: "antarctica-orientation-calibration";
          unlockEntryIds: ["note-calibration"];
          reactions: {
            correct: [{ type: "narration"; text: "Correct" }];
            incorrect: [{ type: "narration"; text: "Incorrect" }];
            timeout: [{ type: "narration"; text: "Timeout" }];
          };
        },
      ];
    },
  ];
  notebookEntries: [{ id: "note-calibration"; text: "Calibration"; relevance: "potential" }];
  questionPoints: { "antarctica-orientation-calibration": 24 };
};

type NarrativeChallengeWithoutNotebook = Omit<ValidNarrativeChallengeDefinition, "notebookEntries">;

export type AcceptsValidMultipleChoice = Assert<IsAssignable<ValidMultipleChoice, Question>>;
export type AcceptsValidMultipleChoiceWithPromptVisual = Assert<
  IsAssignable<ValidMultipleChoiceWithPromptVisual, Question>
>;
export type RejectsMultipleChoiceWithoutOptions = Assert<
  IsNotAssignable<MultipleChoiceWithoutOptions, Question>
>;
export type RejectsMultipleChoiceWithInvalidPromptVisual = Assert<
  IsNotAssignable<MultipleChoiceWithInvalidPromptVisual, Question>
>;
export type RejectsTrueFalseWithStringAnswer = Assert<
  IsNotAssignable<TrueFalseWithStringAnswer, Question>
>;
export type AcceptsValidOddOneOut = Assert<IsAssignable<ValidOddOneOut, Question>>;
export type RejectsOddOneOutWithoutLabels = Assert<
  IsNotAssignable<OddOneOutWithoutLabels, Question>
>;
export type RejectsOddOneOutWithNumericAnswer = Assert<
  IsNotAssignable<OddOneOutWithNumericAnswer, Question>
>;
export type AcceptsValidMatching = Assert<IsAssignable<ValidMatching, Question>>;
export type RejectsMatchingWithoutReferences = Assert<
  IsNotAssignable<MatchingWithoutReferences, Question>
>;
export type RejectsMatchingWithInvalidMedia = Assert<
  IsNotAssignable<MatchingWithInvalidMedia, Question>
>;
export type AcceptsValidConnectPairs = Assert<IsAssignable<ValidConnectPairs, Question>>;
export type RejectsConnectPairsWithoutSolution = Assert<
  IsNotAssignable<ConnectPairsWithoutSolution, Question>
>;
export type RejectsConnectPairsWithLooseCoverage = Assert<
  IsNotAssignable<ConnectPairsWithLooseCoverage, Question>
>;
export type AcceptsValidProgressiveClues = Assert<IsAssignable<ValidProgressiveClues, Question>>;
export type RejectsProgressiveCluesWithoutClues = Assert<
  IsNotAssignable<ProgressiveCluesWithoutClues, Question>
>;
export type RejectsProgressiveCluesWithoutPenalty = Assert<
  IsNotAssignable<ProgressiveCluesWithoutPenalty, Question>
>;
export type RejectsProgressiveCluesWithoutAnswer = Assert<
  IsNotAssignable<ProgressiveCluesWithoutAnswer, Question>
>;
export type AcceptsValidProgressiveImage = Assert<IsAssignable<ValidProgressiveImage, Question>>;
export type RejectsProgressiveImageWithoutSurface = Assert<
  IsNotAssignable<ProgressiveImageWithoutSurface, Question>
>;
export type RejectsProgressiveImageWithoutSolutionAlt = Assert<
  IsNotAssignable<ProgressiveImageWithoutSolutionAlt, Question>
>;
export type RejectsProgressiveImageWithoutRevealDuration = Assert<
  IsNotAssignable<ProgressiveImageWithoutRevealDuration, Question>
>;
export type RejectsProgressiveImageWithoutAnswer = Assert<
  IsNotAssignable<ProgressiveImageWithoutAnswer, Question>
>;
export type AcceptsValidTimeMaze = Assert<IsAssignable<ValidTimeMaze, Question>>;
export type RejectsTimeMazeWithoutGrid = Assert<IsNotAssignable<TimeMazeWithoutGrid, Question>>;
export type RejectsTimeMazeWithoutCells = Assert<IsNotAssignable<TimeMazeWithoutCells, Question>>;
export type AcceptsValidZip = Assert<IsAssignable<ValidZip, Question>>;
export type RejectsZipWithoutCheckpoints = Assert<IsNotAssignable<ZipWithoutCheckpoints, Question>>;
export type RejectsZipWithoutSolution = Assert<IsNotAssignable<ZipWithoutSolution, Question>>;
export type RejectsZipWithUnsupportedGrid = Assert<
  IsNotAssignable<ZipWithUnsupportedGrid, Question>
>;
export type AcceptsValidQueens = Assert<IsAssignable<ValidQueens, Question>>;
export type RejectsQueensWithoutRegions = Assert<IsNotAssignable<QueensWithoutRegions, Question>>;
export type RejectsQueensWithoutSolution = Assert<IsNotAssignable<QueensWithoutSolution, Question>>;
export type RejectsQueensWithUnsupportedGrid = Assert<
  IsNotAssignable<QueensWithUnsupportedGrid, Question>
>;
export type AcceptsValidHeatMap = Assert<IsAssignable<ValidHeatMap, Question>>;
export type RejectsHeatMapWithoutSurface = Assert<IsNotAssignable<HeatMapWithoutSurface, Question>>;
export type RejectsHeatMapWithoutTarget = Assert<IsNotAssignable<HeatMapWithoutTarget, Question>>;
export type RejectsHeatMapWithoutRadii = Assert<IsNotAssignable<HeatMapWithoutRadii, Question>>;
export type AcceptsValidImageLabeling = Assert<IsAssignable<ValidImageLabeling, Question>>;
export type AcceptsValidSingleChoiceImageLabeling = Assert<
  IsAssignable<ValidSingleChoiceImageLabeling, Question>
>;
export type AcceptsValidSingleTextImageLabeling = Assert<
  IsAssignable<ValidSingleTextImageLabeling, Question>
>;
export type RejectsImageLabelingWithoutSurface = Assert<
  IsNotAssignable<ImageLabelingWithoutSurface, Question>
>;
export type RejectsImageLabelingWithoutAnchors = Assert<
  IsNotAssignable<ImageLabelingWithoutAnchors, Question>
>;
export type RejectsImageLabelingWithoutLabels = Assert<
  IsNotAssignable<ImageLabelingWithoutLabels, Question>
>;
export type RejectsImageLabelingWithoutCorrectReference = Assert<
  IsNotAssignable<ImageLabelingWithoutCorrectReference, Question>
>;
export type RejectsImageLabelingWithoutTask = Assert<
  IsNotAssignable<ImageLabelingWithoutTask, Question>
>;
export type AcceptsValidMemoryPairs = Assert<IsAssignable<ValidMemoryPairs, Question>>;
export type RejectsMemoryPairsWithoutGrid = Assert<
  IsNotAssignable<MemoryPairsWithoutGrid, Question>
>;
export type RejectsMemoryPairsWithoutTiles = Assert<
  IsNotAssignable<MemoryPairsWithoutTiles, Question>
>;
export type RejectsMemoryPairsTileWithoutPair = Assert<
  IsNotAssignable<MemoryPairsTileWithoutPair, Question>
>;
export type RejectsSingleImageLabelingWithoutTarget = Assert<
  IsNotAssignable<SingleImageLabelingWithoutTarget, Question>
>;
export type RejectsSingleImageLabelingWithoutOptions = Assert<
  IsNotAssignable<SingleImageLabelingWithoutOptions, Question>
>;
export type RejectsSingleImageLabelingWithoutAnswer = Assert<
  IsNotAssignable<SingleImageLabelingWithoutAnswer, Question>
>;
export type AcceptsValidNarrativeChallengeDefinition = Assert<
  IsAssignable<ValidNarrativeChallengeDefinition, ChallengeDefinition>
>;
export type RejectsNarrativeChallengeWithoutNotebook = Assert<
  IsNotAssignable<NarrativeChallengeWithoutNotebook, ChallengeDefinition>
>;
