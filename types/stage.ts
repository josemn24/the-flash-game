import type { Question } from "@/types/question";

export type Stage = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  questions: Question[];
};

export type StageSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  questionCount: number;
};
