import type { Question } from "@/types/game";

type Assert<T extends true> = T;
type IsAssignable<Source, Target> = Source extends Target ? true : false;
type IsNotAssignable<Source, Target> = IsAssignable<Source, Target> extends false ? true : false;

type ValidMultipleChoice = {
  id: "valid-choice";
  type: "multiple-choice";
  category: "Test";
  question: "Choose one";
  options: ["A", "B"];
  correctAnswer: "A";
  timeLimit: 10;
  points: 100;
  explanation: "A is correct";
};

type MultipleChoiceWithoutOptions = Omit<ValidMultipleChoice, "options">;
type TrueFalseWithStringAnswer = Omit<ValidMultipleChoice, "type" | "options"> & {
  type: "true-false";
};

type ValidOddOneOut = {
  id: "valid-odd-one-out";
  type: "odd-one-out";
  category: "Test";
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

type ValidProgressiveClues = {
  id: "valid-progressive-clues";
  type: "progressive-clues";
  category: "Test";
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

type ValidHeatMap = {
  id: "valid-heat-map";
  type: "heat-map";
  category: "Test";
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
  category: "Test";
  question: "Label the image";
  surface: { src: "/diagram.svg"; alt: "Diagram"; width: 600; height: 720 };
  anchors: [{ id: "top"; point: { x: 0.5; y: 0.2 }; correctLabelId: "top-label" }];
  labels: [{ id: "top-label"; label: "Top" }];
  timeLimit: 20;
  points: 100;
  explanation: "The top label belongs at the top";
};

type ImageLabelingWithoutSurface = Omit<ValidImageLabeling, "surface">;
type ImageLabelingWithoutAnchors = Omit<ValidImageLabeling, "anchors">;
type ImageLabelingWithoutLabels = Omit<ValidImageLabeling, "labels">;
type ImageLabelingWithoutCorrectReference = Omit<ValidImageLabeling, "anchors"> & {
  anchors: [{ id: "top"; point: { x: 0.5; y: 0.2 } }];
};

export type AcceptsValidMultipleChoice = Assert<IsAssignable<ValidMultipleChoice, Question>>;
export type RejectsMultipleChoiceWithoutOptions = Assert<
  IsNotAssignable<MultipleChoiceWithoutOptions, Question>
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
export type AcceptsValidHeatMap = Assert<IsAssignable<ValidHeatMap, Question>>;
export type RejectsHeatMapWithoutSurface = Assert<IsNotAssignable<HeatMapWithoutSurface, Question>>;
export type RejectsHeatMapWithoutTarget = Assert<IsNotAssignable<HeatMapWithoutTarget, Question>>;
export type RejectsHeatMapWithoutRadii = Assert<IsNotAssignable<HeatMapWithoutRadii, Question>>;
export type AcceptsValidImageLabeling = Assert<IsAssignable<ValidImageLabeling, Question>>;
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
