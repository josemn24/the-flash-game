import type { UtcIsoDateTime } from "./values";

export type TimeTrialEndReason =
  "all_solved" | "validation_limit" | "time_limit" | "recovery_interrupted";

/** Safe projection of persisted facts, independent of the Queens draft. */
export type TimeTrialProgress = {
  readonly kind: "time-trial";
  readonly currentIndex: number;
  readonly solvedCount: number;
  readonly totalCount: number;
  readonly points: number;
  readonly elapsedTimeMs: number;
  readonly clockStartedAt: UtcIsoDateTime | null;
  readonly deadlineAt: UtcIsoDateTime | null;
  readonly serverNow: UtcIsoDateTime;
  readonly lastCorrectElapsedMs: number | null;
  readonly endReason: TimeTrialEndReason | null;
};

/** A confirmed regulatory result; abandonment has the common lifecycle contract. */
export type TimeTrialResult = TimeTrialProgress & {
  readonly clockStartedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime;
  readonly endReason: TimeTrialEndReason;
};
