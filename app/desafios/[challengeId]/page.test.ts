import { describe, expect, it, vi } from "vitest";
import { mockChallengeQueries } from "@/infrastructure/mock/composition";
import { mockQueryContext } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getPlayableChallengePageModel: vi.fn(),
  getRoomIntroductionPageModel: vi.fn(),
}));

vi.mock("@/server/production-challenge-data-access", () => mocks);
vi.mock("@/server/production-room-data-access", () => mocks);

import ChallengePage, { dynamic } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

describe("challenge route room context", () => {
  it("passes Tabarnia context to the canonical challenge route", async () => {
    mocks.getPlayableChallengePageModel.mockResolvedValue(
      await mockChallengeQueries.getPlayable(
        "tabarnia-challenge-05",
        "tabarnia-room",
        await mockQueryContext(),
      ),
    );
    const element = await ChallengePage({
      params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }),
      searchParams: Promise.resolve({ roomId: "tabarnia-room" }),
    });

    expect(element.props.roomContext).toMatchObject({
      roomId: "tabarnia-room",
      roomTitle: "Tabarnia",
      returnTo: "/salas/tabarnia-room",
      memberId: "player",
      attemptStatus: "completed",
    });
    expect(element.props.roomContext.result).toMatchObject({
      flashPoints: expect.any(Number),
      completed: true,
    });
  });

  it("rejects direct challenge access without a persisted room context", async () => {
    mocks.getPlayableChallengePageModel.mockResolvedValue(null);
    await expect(
      ChallengePage({
        params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("rejects mock room aliases in the production route", async () => {
    mocks.getPlayableChallengePageModel.mockResolvedValue(null);
    await expect(
      ChallengePage({
        params: Promise.resolve({ challengeId: "tabarnia-challenge-06" }),
        searchParams: Promise.resolve({ roomId: "tabarnia-room" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("rejects a roomless request even when the challenge id is a fixture id", async () => {
    mocks.getPlayableChallengePageModel.mockResolvedValue(null);
    await expect(
      ChallengePage({
        params: Promise.resolve({ challengeId: "tabarnia-challenge-06" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("rejects an unknown contextual room", async () => {
    mocks.getPlayableChallengePageModel.mockResolvedValue(null);
    await expect(
      ChallengePage({
        params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }),
        searchParams: Promise.resolve({ roomId: "unknown-room" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("does not enumerate challenge routes at build time", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
