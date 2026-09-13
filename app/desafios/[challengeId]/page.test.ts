import { describe, expect, it, vi } from "vitest";
import ChallengePage, { dynamic } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

describe("challenge route room context", () => {
  it("passes Tabarnia context to the canonical challenge route", async () => {
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

  it("keeps direct challenge access without a room context", async () => {
    const element = await ChallengePage({
      params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }),
      searchParams: Promise.resolve({}),
    });

    expect(element.props.roomContext).toBeUndefined();
  });

  it("rejects an unknown contextual room", async () => {
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
