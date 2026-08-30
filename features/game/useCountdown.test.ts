import { describe, expect, it } from "vitest";
import {
  createCountdownCompletionGuard,
  getCountdownMetrics,
  getCountdownRemaining,
} from "@/features/game/useCountdown";

describe("countdown foundations", () => {
  it("resolves a deadline and clamps expired time to zero", () => {
    expect(getCountdownRemaining(15_000, 10_000)).toBe(5);
    expect(getCountdownRemaining(10_000, 15_000)).toBe(0);
  });

  it("clamps values and marks ratio-based urgency", () => {
    expect(getCountdownMetrics(20, 30, { type: "ratio", value: 0.25 })).toMatchObject({
      remaining: 20,
      ratio: 1,
      display: 20,
      urgent: false,
      finished: false,
    });
    const urgent = getCountdownMetrics(20, 4.2, { type: "ratio", value: 0.25 });
    expect(urgent).toMatchObject({
      remaining: 4.2,
      display: 5,
      urgent: true,
      finished: false,
    });
    expect(urgent.ratio).toBeCloseTo(0.21);
    expect(getCountdownMetrics(20, -2, { type: "ratio", value: 0.25 })).toMatchObject({
      remaining: 0,
      ratio: 0,
      display: 0,
      urgent: false,
      finished: true,
    });
  });

  it("supports the legacy fixed-seconds urgency threshold", () => {
    expect(getCountdownMetrics(60, 5, { type: "seconds", value: 5 }).urgent).toBe(true);
    expect(getCountdownMetrics(60, 6, { type: "seconds", value: 5 }).urgent).toBe(false);
  });

  it("notifies completion once and resets with a new guard", () => {
    const firstRun = createCountdownCompletionGuard();
    expect(firstRun.shouldNotify(1)).toBe(false);
    expect(firstRun.shouldNotify(0)).toBe(true);
    expect(firstRun.shouldNotify(0)).toBe(false);

    const resetRun = createCountdownCompletionGuard();
    expect(resetRun.shouldNotify(0)).toBe(true);
  });
});
