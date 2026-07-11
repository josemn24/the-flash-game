export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-text"
  | "image-choice"
  | "ordering"
  | "classification"
  | "logic-code"
  | "estimation";

export type QuestionIllustration = "japan-flag" | "saturn" | "italy-flag";

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

type BaseQuestion = {
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
  acceptedAnswers?: never;
  media?: never;
  items?: never;
  correctOrder?: never;
};

export type ImageChoiceQuestion = BaseQuestion & {
  type: "image-choice";
  options: string[];
  correctAnswer: string;
  media: QuestionMedia;
  acceptedAnswers?: never;
  items?: never;
  correctOrder?: never;
};

export type TrueFalseQuestion = BaseQuestion & {
  type: "true-false";
  correctAnswer: boolean;
  options?: never;
  acceptedAnswers?: never;
  media?: never;
  items?: never;
  correctOrder?: never;
};

export type ShortTextQuestion = BaseQuestion & {
  type: "short-text";
  correctAnswer: string;
  acceptedAnswers?: string[];
  options?: never;
  media?: never;
  items?: never;
  correctOrder?: never;
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
  options?: never;
  acceptedAnswers?: never;
  media?: never;
  items?: never;
  correctOrder?: never;
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
  options?: never;
  acceptedAnswers?: never;
  items?: never;
  correctOrder?: never;
};

export type OrderingQuestion = BaseQuestion & {
  type: "ordering";
  items: string[];
  correctOrder: string[];
  options?: never;
  correctAnswer?: never;
  acceptedAnswers?: never;
  media?: never;
};

export type ClassificationItem = {
  label: string;
  correctCategory: string;
};

export type ClassificationQuestion = BaseQuestion & {
  type: "classification";
  items: ClassificationItem[];
  categories: string[];
  options?: never;
  correctAnswer?: never;
  acceptedAnswers?: never;
  correctOrder?: never;
  media?: never;
};

export type Question =
  | MultipleChoiceQuestion
  | ImageChoiceQuestion
  | TrueFalseQuestion
  | ShortTextQuestion
  | OrderingQuestion
  | ClassificationQuestion
  | LogicCodeQuestion
  | EstimationQuestion;

export type Stage = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  questions: Question[];
};

export type ClassificationAnswer = Record<string, string>;

export type AnswerValue = string | number | boolean | string[] | ClassificationAnswer;

export type AnswerStatus = "correct" | "partial" | "incorrect" | "unanswered";

export type AnswerResult = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points: number;
  timeUsed: number;
  submittedCodes?: string[];
  incorrectAttempts?: number;
  difference?: number;
  proximity?: number;
};

export type GameScreen = "start" | "intro" | "playing" | "transition" | "results" | "review";
