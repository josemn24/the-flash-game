export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-text"
  | "image-choice"
  | "ordering";

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

type StandardQuestion = BaseQuestion & {
  type: Exclude<QuestionType, "ordering">;
  options?: string[];
  correctAnswer: string | boolean;
  acceptedAnswers?: string[];
  media?: QuestionMedia;
  items?: never;
  correctOrder?: never;
};

export type OrderingQuestion = BaseQuestion & {
  type: "ordering";
  items: string[];
  correctOrder: string[];
  instruction?: string;
  options?: never;
  correctAnswer?: never;
  acceptedAnswers?: never;
  media?: never;
};

export type Question = StandardQuestion | OrderingQuestion;

export type Stage = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  questions: Question[];
};

export type AnswerValue = string | boolean | string[];

export type AnswerStatus = "correct" | "incorrect" | "unanswered";

export type AnswerResult = {
  questionId: string;
  answer: AnswerValue | null;
  status: AnswerStatus;
  isCorrect: boolean;
  points: number;
  timeUsed: number;
};

export type GameScreen =
  | "start"
  | "intro"
  | "playing"
  | "transition"
  | "results"
  | "review";
