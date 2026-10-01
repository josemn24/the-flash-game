import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  FlashPopLobby: vi.fn((props: unknown) => props),
  getFlashPopLobbyPageModel: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/components/game/demo", () => ({ FlashPopLobby: mocks.FlashPopLobby }));
vi.mock("@/server/demo-data-access", () => ({
  getFlashPopLobbyPageModel: mocks.getFlashPopLobbyPageModel,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import FlashPopPage, { dynamic, metadata } from "./page";

describe("Flash Pop demo lobby route", () => {
  it("renders the demo lobby through the demo barrel", async () => {
    mocks.getFlashPopLobbyPageModel.mockResolvedValue({
      primary: { challenge: { mode: "pyramid" } },
      secondary: { challenge: { mode: "pyramid" } },
    });

    const element = await FlashPopPage();

    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("The Flash — Lobby");
    expect(element.type).toBe(mocks.FlashPopLobby);
    expect(element.props).toEqual(expect.objectContaining({ model: expect.any(Object) }));
  });
});
