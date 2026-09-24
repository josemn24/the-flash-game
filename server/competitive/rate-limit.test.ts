import { afterEach, describe, expect, it } from "vitest";
import {
  consumeAlphabetActionRateLimit,
  CompetitiveRateLimitError,
  consumeCompetitiveRateLimit,
  resetCompetitiveRateLimitForTests,
} from "@/server/competitive/rate-limit";

afterEach(() => resetCompetitiveRateLimitForTests());

describe("competitive rate limit", () => {
  it("allows a burst of thirty and then returns a retry window", () => {
    for (let index = 0; index < 30; index += 1) {
      expect(consumeCompetitiveRateLimit("player", 0).remaining).toBe(29 - index);
    }

    expect(() => consumeCompetitiveRateLimit("player", 0)).toThrow(CompetitiveRateLimitError);
    try {
      consumeCompetitiveRateLimit("player", 0);
    } catch (error) {
      expect(error).toMatchObject({ code: "rate_limited", status: 429, retryAfterSeconds: 2 });
    }
  });

  it("refills tokens over time and isolates players", () => {
    for (let index = 0; index < 30; index += 1) consumeCompetitiveRateLimit("player", 0);
    expect(consumeCompetitiveRateLimit("other-player", 0).remaining).toBe(29);
    expect(consumeCompetitiveRateLimit("player", 2_000).remaining).toBe(0);
  });

  it("shares Alphabet actions per user and attempt, refilling one action per second", () => {
    for (let index = 0; index < 5; index += 1) {
      consumeAlphabetActionRateLimit("player", "attempt", 0);
    }
    expect(() => consumeAlphabetActionRateLimit("player", "attempt", 0)).toThrow(
      CompetitiveRateLimitError,
    );
    expect(consumeAlphabetActionRateLimit("player", "attempt", 1_000).remaining).toBe(0);
    expect(consumeAlphabetActionRateLimit("player", "other-attempt", 0).remaining).toBe(4);
    expect(consumeAlphabetActionRateLimit("other-player", "attempt", 0).remaining).toBe(4);
  });
});
