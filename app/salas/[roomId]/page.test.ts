import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRoomDetailPageModel: vi.fn(),
}));

vi.mock("@/server/production-data-access", () => mocks);

import { dynamic, generateMetadata } from "./page";

describe("room detail route", () => {
  it("renders the metadata supplied by the production facade", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getRoomDetailPageModel.mockResolvedValue({ title: "Tabarnia" });
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "persisted-room" }) }),
    ).resolves.toMatchObject({
      title: "Tabarnia — The Flash",
    });
  });

  it("does not provide a mock fallback for an unknown room", async () => {
    mocks.getRoomDetailPageModel.mockResolvedValue(null);
    await expect(
      generateMetadata({ params: Promise.resolve({ roomId: "tabarnia-room" }) }),
    ).resolves.toMatchObject({ title: "Sala no encontrada — The Flash" });
  });
});
