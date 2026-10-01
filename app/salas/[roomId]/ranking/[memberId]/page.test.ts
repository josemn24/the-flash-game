import { describe, expect, it, vi } from "vitest";
import { mockQueryContext, mockRoomQueries } from "@/test-utils/mockRoom";

const mocks = vi.hoisted(() => ({
  getRoomMemberDetailPageModel: vi.fn(),
}));

vi.mock("@/server/production-data-access", () => mocks);
import MemberRankingPage, { dynamic, generateMetadata } from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

describe("room member ranking route", () => {
  it("exposes Tabarnia members and player metadata", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomMemberDetailPageModel.mockResolvedValue(
      await mockRoomQueries.getMemberDetail("tabarnia-room", "ches", mockQueryContext()),
    );
    await expect(
      generateMetadata({
        params: Promise.resolve({
          roomId: "persisted-room",
          memberId: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    ).resolves.toMatchObject({ title: "Dark — Tabarnia — The Flash" });
  });

  it("resolves a known member", async () => {
    mocks.getRoomMemberDetailPageModel.mockResolvedValue(
      await mockRoomQueries.getMemberDetail("tabarnia-room", "ches", mockQueryContext()),
    );
    const element = await MemberRankingPage({
      params: Promise.resolve({
        roomId: "persisted-room",
        memberId: "00000000-0000-4000-8000-000000000002",
      }),
    });

    expect(element.props.model.member.name).toBe("Dark");
  });

  it("rejects unknown rooms and members", async () => {
    mocks.getRoomMemberDetailPageModel.mockResolvedValue(null);
    await expect(
      MemberRankingPage({
        params: Promise.resolve({
          roomId: "persisted-room",
          memberId: "00000000-0000-4000-8000-000000000099",
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
