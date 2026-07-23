import type { Question } from "@/types/question";

export type GameMode = "flash";

export type Challenge = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questions: Question[];
};

export type ChallengeSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  mode: GameMode;
  questionCount: number;
};
