import type { ReactNode } from "react";
import type { AvatarTone } from "@/components/ui";

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
  eyebrow: string;
  title: string;
  subtitle?: string;
  score: number;
  maxScore: number;
  accuracy: number;
  totalTime: number;
  metrics: ResultMetric[];
  supplementalContent?: ReactNode;
};

export type ChallengeResultScreenProps = {
  model: ChallengeResultModel;
  onReview: () => void;
  onReplay: () => void;
  returnTo?: string;
  returnLabel?: string;
};

export type ResultRankingRow = {
  id: string;
  rank: number;
  name: string;
  initials: string;
  tone: AvatarTone;
  score: ReactNode;
  current?: boolean;
};

export type ResultRankingProps = {
  rows: ResultRankingRow[];
  title?: string;
  meta?: string;
};
