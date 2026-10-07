import type { PracticeQuestionOfType, PracticeQuestionType } from "@/types/gameplay/practice";
import type { ScoringPolicy } from "./scoringPolicies";

export type QuestionFormatGuide<T extends PracticeQuestionType = PracticeQuestionType> = {
  id: T;
  slug: string;
  name: string;
  shortName: string;
  summary: string;
  description: string[];
  recommendations: string[];
  avoidWhen: string[];
  rules: string[];
  authoringTips: string[];
  accessibility: string[];
  mediaSupport: string[];
  timing: { recommendedSeconds: string; notes: string };
  scoring: ScoringPolicy;
  examples: Array<{ title: string; question: PracticeQuestionOfType<T> }>;
};

export type QuestionFormatCatalog = {
  [T in PracticeQuestionType]: QuestionFormatGuide<T>;
};
