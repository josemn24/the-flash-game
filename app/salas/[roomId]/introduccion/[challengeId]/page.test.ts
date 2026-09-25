import { describe, expect, it, vi } from "vitest";
import RoomIntroductionPage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("legacy room introduction route", () => {
  it("redirects to the canonical challenge route without rendering a second intro", async () => {
    await expect(
      RoomIntroductionPage({
        params: Promise.resolve({
          roomId: "browser-playground",
          challengeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        }),
      }),
    ).rejects.toThrow(
      "REDIRECT:/desafios/cccccccc-cccc-4ccc-8ccc-cccccccccccc?roomId=browser-playground",
    );
  });
});
