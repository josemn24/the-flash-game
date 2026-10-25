import type { ReactNode } from "react";
export type ResultMetricTone = "default" | "success" | "danger" | "social";

export type ResultMetric = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: ResultMetricTone;
};

export type ChallengeResultModel = {
  gameTitle: string;
  statusLabel: string;
  title: string;
  subtitle?: string;
  score: number;
  maxScore: number;
  scoreUnit?: "points" | "flashPoints";
  accuracy: number;
  totalTime: number;
  metrics: ResultMetric[];
};

export type ChallengeResultScreenProps = {
  model: ChallengeResultModel;
  onReview?: () => void;
  onReplay?: () => void;
  expired?: boolean;
  returnTo?: string;
  returnLabel?: string;
  prefetchReturnLink?: boolean;
};
