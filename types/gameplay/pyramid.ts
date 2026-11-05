import type { PyramidAttemptOutcome } from "@/types/domain/attempt";

/** Result data shared by session presentation, review and demo social projections. */
export type PyramidResultSummary = {
  readonly challengeId: string;
  readonly startedAt: number;
  readonly levelsCleared: number;
  readonly score: number;
  readonly timeUsed: number;
  readonly outcome: PyramidAttemptOutcome;
  readonly completedAt: number;
};

/** Optional lobby projection; never a playable session or a persistence record. */
export type PyramidDemoProgress = {
  readonly status: "inProgress" | "completed";
  readonly summary?: PyramidResultSummary;
  readonly currentLevelIndex?: number;
};
