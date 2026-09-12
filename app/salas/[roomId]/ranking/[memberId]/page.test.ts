import { describe, expect, it, vi } from "vitest";
import MemberRankingPage, { generateMetadata, generateStaticParams } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

describe("room member ranking route", () => {
  it("exposes Tabarnia members and player metadata", async () => {
    expect(generateStaticParams()).toHaveLength(5);
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room", memberId: "ches" }) }),
    ).resolves.toMatchObject({ title: "Dark — Tabarnia — Flash Pop" });
  });

  it("resolves a known member", async () => {
    const element = await MemberRankingPage({
      params: Promise.resolve({ roomId: "tabarnia-room", memberId: "ches" }),
    });

    expect(element.props.model.member.name).toBe("Dark");
  });

  it("rejects unknown rooms and members", async () => {
    await expect(
      MemberRankingPage({
        params: Promise.resolve({ roomId: "missing-room", memberId: "ches" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      MemberRankingPage({
        params: Promise.resolve({ roomId: "tabarnia-room", memberId: "missing-member" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
