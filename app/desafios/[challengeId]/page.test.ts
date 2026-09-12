import { describe, expect, it, vi } from "vitest";
import ChallengePage, { generateStaticParams } from "./page";

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

    expect(element.props.roomContext).toEqual({
      roomId: "tabarnia-room",
      roomTitle: "Tabarnia",
      returnTo: "/salas/tabarnia-room",
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

  it("continues exposing every playable challenge", () => {
    expect(generateStaticParams().length).toBeGreaterThanOrEqual(5);
  });
});
