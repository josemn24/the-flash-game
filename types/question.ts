export type QuestionIllustration = "japan-flag" | "saturn" | "italy-flag" | "france-flag";

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
  question: string;
  timeLimit: number;
  points: number;
  explanation: string;
};

export type MultipleChoiceQuestion = BaseQuestion & {
  type: "multiple-choice";
  options: string[];
  correctAnswer: string;
  media?: QuestionMedia;
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

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type ImageSurface = {
  src: string;
  alt: string;
  width: number;
  height: number;
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

export type Question =
  | MultipleChoiceQuestion
  | OddOneOutQuestion
  | MatchingQuestion
  | TrueFalseQuestion
  | ShortTextQuestion
  | ProgressiveCluesQuestion
  | HeatMapQuestion
  | ImageLabelingQuestion
  | OrderingQuestion
  | ClassificationQuestion
  | LogicCodeQuestion
  | EstimationQuestion;

export type QuestionType = Question["type"];
export type QuestionOfType<T extends QuestionType> = Extract<Question, { type: T }>;

export type ClassificationAnswer = Record<string, string>;
export type MatchingAnswer = Record<string, string>;
export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | ClassificationAnswer
  | MatchingAnswer
  | HeatMapAnswer
  | ImageLabelingAnswer;
