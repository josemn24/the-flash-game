import { describe, expect, it } from "vitest";
import {
  compareChallengeRankingMetrics,
  rankChallengeEntries,
  sumEffectiveDurationMs,
} from "@/lib/challengeRanking";

const base = {
  flashPoints: 80,
  durationMs: 20_000,
  startedAt: "2026-09-14T10:00:00.000Z",
};

describe("challenge ranking", () => {
  it("sums authoritative milliseconds and supports view-model seconds", () => {
    expect(
      sumEffectiveDurationMs([
        { timeUsedMs: 1_250 },
        { timeUsedMs: 750 },
        { timeUsed: 2 },
        { timeUsedMs: -10 },
      ]),
    ).toBe(4_000);
  });

  it("prioritizes Flash Points over duration and start time", () => {
    expect(
      compareChallengeRankingMetrics(base, {
        flashPoints: 81,
        durationMs: Number.MAX_SAFE_INTEGER,
        startedAt: "2999-01-01T00:00:00.000Z",
      }),
    ).toBeGreaterThan(0);
  });

  it("uses duration and then startedAt for equal scores", () => {
    expect(compareChallengeRankingMetrics(base, { ...base, durationMs: 19_999 })).toBeGreaterThan(
      0,
    );
    expect(
      compareChallengeRankingMetrics(base, {
        ...base,
        startedAt: "2026-09-14T09:59:00.000Z",
      }),
    ).toBeGreaterThan(0);
  });

  it("returns zero for a complete tie and assigns competition positions", () => {
    expect(compareChallengeRankingMetrics(base, { ...base })).toBe(0);
    expect(
      rankChallengeEntries([
        { id: "late", ...base },
        { id: "first", ...base, startedAt: "2026-09-14T10:00:00.000Z" },
        { id: "other", ...base, flashPoints: 70 },
      ]).map(({ rank }) => rank),
    ).toEqual([1, 1, 3]);
  });
});
