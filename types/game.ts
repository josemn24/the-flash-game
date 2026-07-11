export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-text"
  | "image-choice";

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

export type Question = {
  id: string;
  type: QuestionType;
  category: string;
  question: string;
  options?: string[];
  correctAnswer: string | boolean;
  acceptedAnswers?: string[];
  media?: QuestionMedia;
  timeLimit: number;
  points: number;
  explanation: string;
};

export type Stage = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  questions: Question[];
};

export type AnswerValue = string | boolean;

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
