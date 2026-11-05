import type { UtcIsoDateTime } from "./values";

export type TimeTrialFormat = "queens" | "connect-pairs";

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

/** An active board always carries the original authoritative global clock. */
export type RunningTimeTrialProgress = TimeTrialProgress & {
  readonly clockStartedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime;
};

/** A confirmed regulatory result; abandonment has the common lifecycle contract. */
export type TimeTrialResult = RunningTimeTrialProgress & {
  readonly endReason: TimeTrialEndReason;
};
