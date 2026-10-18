import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLocalPyramidDemoDefinition: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  LocalPyramidGameApp: vi.fn(() => null),
}));

vi.mock("@/server/demo-data-access", () => ({
  getLocalPyramidDemoDefinition: mocks.getLocalPyramidDemoDefinition,
}));
vi.mock("@/components/game/shells/LocalPyramidGameApp.client", () => ({
  LocalPyramidGameApp: mocks.LocalPyramidGameApp,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import { dynamic } from "./page";
import { generateMetadata } from "./page";
import PyramidDemoPage from "./page";
import { LocalPyramidGameApp } from "@/components/game/shells/LocalPyramidGameApp.client";

describe("Flash Pop Pyramid demo route", () => {
  it("resolves preview aliases dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("renders a local rehearsal composition from the canonical mock definition", async () => {
    const definition = { challenge: { mode: "pyramid", id: "tabarnia-challenge-05" }, levels: [] };
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(definition);

    const page = await PyramidDemoPage({
      params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }),
    });
    expect(page).toMatchObject({ type: LocalPyramidGameApp, props: { definition } });
  });

  it("returns 404 for demo identifiers outside the explicit composition allowlist", async () => {
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    await expect(
      PyramidDemoPage({ params: Promise.resolve({ challengeId: "tabarnia-challenge-06" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("builds route metadata without checking the publication time window", async () => {
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue({
      challenge: {
        mode: "pyramid",
        title: "La Pirámide: Cumbre lógica",
        description: "Sube todo lo que puedas.",
      },
    });
    await expect(
      generateMetadata({ params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }) }),
    ).resolves.toEqual({
      title: "La Pirámide: Cumbre lógica — Ensayo local — The Flash",
      description: "Sube todo lo que puedas.",
    });
  });
});
