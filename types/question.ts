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
  | OrderingQuestion
  | ClassificationQuestion
  | LogicCodeQuestion
  | EstimationQuestion;

export type QuestionType = Question["type"];
export type QuestionOfType<T extends QuestionType> = Extract<Question, { type: T }>;

export type ClassificationAnswer = Record<string, string>;
export type MatchingAnswer = Record<string, string>;
export type AnswerValue =
  string | number | boolean | string[] | ClassificationAnswer | MatchingAnswer;
