import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFlashPopChallengePageModel: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  permanentRedirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

vi.mock("@/server/demo-data-access", () => ({
  getFlashPopChallengePageModel: mocks.getFlashPopChallengePageModel,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

import { dynamic } from "./page";
import PyramidDemoPage from "./page";

describe("Flash Pop Pyramid demo route", () => {
  it("resolves preview aliases dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("keeps the internal redirect to the competitive challenge route", async () => {
    mocks.getFlashPopChallengePageModel.mockResolvedValue({
      challenge: {
        mode: "pyramid",
        title: "La Pirámide",
        description: "Sube todo lo que puedas.",
      },
    });

    await expect(
      PyramidDemoPage({ params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }) }),
    ).rejects.toThrow("REDIRECT:/desafios/tabarnia-challenge-05");
  });
});
