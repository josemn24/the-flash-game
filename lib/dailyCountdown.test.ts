import { describe, expect, it } from "vitest";
import {
  formatDailyCountdown,
  getDailyCountdownSeconds,
  getNextDailyBoundary,
} from "@/lib/dailyCountdown";

describe("daily countdown", () => {
  it("returns the next midnight in Europe/Madrid", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");

    expect(getNextDailyBoundary(now).toISOString()).toBe("2026-09-06T22:00:00.000Z");
  });

  it("handles the Europe/Madrid daylight-saving transition", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");

    expect(getNextDailyBoundary(now).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("calculates and formats a stable remaining duration", () => {
    const endsAt = "2026-09-06T22:00:00.000Z";
    const now = new Date("2026-09-06T21:58:01.500Z");

    expect(getDailyCountdownSeconds(endsAt, now)).toBe(119);
    expect(formatDailyCountdown(119)).toBe("00:01:59");
    expect(formatDailyCountdown(0)).toBe("00:00:00");
  });
});
