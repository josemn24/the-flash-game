import { InvalidAttemptLifecycleError } from "@/lib/attemptLifecycle";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readTerminalReviewSafely } from "./flashResult";
const readers = vi.hoisted(() => ({ flash: vi.fn() }));
vi.mock("@/infrastructure/supabase/gameplay/flashQueries", () => ({
  supabaseFlashQueries: { getTerminalReview: readers.flash },
}));
vi.mock("@/infrastructure/supabase/gameplay/alphabetQueries", () => ({
  supabaseAlphabetQueries: { getTerminalReview: async () => [] },
}));
vi.mock("@/infrastructure/supabase/gameplay/survivalQueries", () => ({
  supabaseSurvivalQueries: { getTerminalReview: async () => [] },
}));
vi.mock("@/infrastructure/supabase/gameplay/pyramidQueries", () => ({
  supabasePyramidQueries: { getTerminalReview: async () => [] },
}));
vi.mock("@/infrastructure/supabase/gameplay/narrativeQueries", () => ({
  supabaseNarrativeQueries: { getTerminalReview: async () => [] },
}));
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe("terminal review is optional after a confirmed result", () => {
  it("returns the loaded review", async () => {
    const review = [{ challengeItemId: "item", publicPayload: {}, solutionPayload: {} }];
    readers.flash.mockResolvedValue(review);
    await expect(readTerminalReviewSafely("attempt")).resolves.toEqual({ review });
  });
  it("propagates contract corruption instead of marking the review as pending", async () => {
    readers.flash.mockRejectedValue(new InvalidAttemptLifecycleError());
    await expect(readTerminalReviewSafely("attempt")).rejects.toMatchObject({
      code: "invalid_attempt_lifecycle",
    });
  });

  it("reports Storage failure as pending instead of failing completion", async () => {
    readers.flash.mockRejectedValue(new Error("Storage unavailable"));
    await expect(readTerminalReviewSafely("attempt")).resolves.toEqual({
      review: [],
      reviewPending: true,
    });
  });
  it("stops waiting for a hanging review after two seconds", async () => {
    vi.useFakeTimers();
    readers.flash.mockReturnValue(new Promise(() => {}));
    const response = readTerminalReviewSafely("attempt");
    await vi.advanceTimersByTimeAsync(2000);
    await expect(response).resolves.toEqual({ review: [], reviewPending: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});
