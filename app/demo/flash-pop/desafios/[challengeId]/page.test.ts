import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLocalPyramidDemoDefinition: vi.fn(),
  getLocalFlashDemoDefinition: vi.fn(),
  getLocalAlphabetDemoDefinition: vi.fn(),
  getLocalSurvivalDemoDefinition: vi.fn(),
  getLocalTimeTrialDemoDefinition: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  LocalPyramidGameApp: vi.fn(() => null),
  LocalFlashGameApp: vi.fn(() => null),
  LocalAlphabetGameApp: vi.fn(() => null),
  LocalSurvivalGameApp: vi.fn(() => null),
  LocalTimeTrialGameApp: vi.fn(() => null),
}));

vi.mock("@/server/demo-data-access", () => ({
  getLocalPyramidDemoDefinition: mocks.getLocalPyramidDemoDefinition,
  getLocalFlashDemoDefinition: mocks.getLocalFlashDemoDefinition,
  getLocalAlphabetDemoDefinition: mocks.getLocalAlphabetDemoDefinition,
  getLocalSurvivalDemoDefinition: mocks.getLocalSurvivalDemoDefinition,
  getLocalTimeTrialDemoDefinition: mocks.getLocalTimeTrialDemoDefinition,
}));
vi.mock("@/components/game/shells/LocalFlashGameApp.client", () => ({
  LocalFlashGameApp: mocks.LocalFlashGameApp,
}));
vi.mock("@/components/game/shells/LocalAlphabetGameApp.client", () => ({
  LocalAlphabetGameApp: mocks.LocalAlphabetGameApp,
}));
vi.mock("@/components/game/shells/LocalSurvivalGameApp.client", () => ({
  LocalSurvivalGameApp: mocks.LocalSurvivalGameApp,
}));
vi.mock("@/components/game/shells/LocalPyramidGameApp.client", () => ({
  LocalPyramidGameApp: mocks.LocalPyramidGameApp,
}));
vi.mock("@/components/game/shells/LocalTimeTrialGameApp.client", () => ({
  LocalTimeTrialGameApp: mocks.LocalTimeTrialGameApp,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import { dynamic } from "./page";
import { generateMetadata } from "./page";
import PyramidDemoPage from "./page";
import { LocalPyramidGameApp } from "@/components/game/shells/LocalPyramidGameApp.client";
import { LocalFlashGameApp } from "@/components/game/shells/LocalFlashGameApp.client";
import { LocalAlphabetGameApp } from "@/components/game/shells/LocalAlphabetGameApp.client";
import { LocalSurvivalGameApp } from "@/components/game/shells/LocalSurvivalGameApp.client";
import { LocalTimeTrialGameApp } from "@/components/game/shells/LocalTimeTrialGameApp.client";

describe("Flash Pop local demo route", () => {
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

  it("renders the shared Flash rehearsal for the approved Steel Ball Run id", async () => {
    const definition = { challenge: { mode: "flash", id: "tabarnia-flash-01" }, levels: [] };
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    mocks.getLocalFlashDemoDefinition.mockResolvedValue(definition);

    const page = await PyramidDemoPage({
      params: Promise.resolve({ challengeId: "tabarnia-flash-01" }),
    });
    expect(page).toMatchObject({ type: LocalFlashGameApp, props: { definition } });
  });

  it("renders the shared Survival rehearsal for its approved challenge id", async () => {
    const definition = {
      challenge: { mode: "survival", id: "tabarnia-challenge-03", lives: 3 },
      levels: Array.from({ length: 20 }),
    };
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    mocks.getLocalFlashDemoDefinition.mockResolvedValue(null);
    mocks.getLocalSurvivalDemoDefinition.mockResolvedValue(definition);

    const page = await PyramidDemoPage({
      params: Promise.resolve({ challengeId: "tabarnia-challenge-03" }),
    });
    expect(page).toMatchObject({ type: LocalSurvivalGameApp, props: { definition } });
  });

  it.each([
    ["tabarnia-time-trial-queens-01", "queens"],
    ["tabarnia-time-trial-connect-pairs-01", "connect-pairs"],
  ] as const)("renders the local Time Trial rehearsal for %s", async (id, format) => {
    const definition = {
      challenge: { mode: "time-trial", id, slots: [{ questionType: format }] },
      levels: [],
    };
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    mocks.getLocalFlashDemoDefinition.mockResolvedValue(null);
    mocks.getLocalSurvivalDemoDefinition.mockResolvedValue(null);
    mocks.getLocalTimeTrialDemoDefinition.mockResolvedValue(definition);

    const page = await PyramidDemoPage({ params: Promise.resolve({ challengeId: id }) });
    expect(page).toMatchObject({ type: LocalTimeTrialGameApp, props: { definition } });
  });

  it("renders the full local Alphabet rehearsal for the approved challenge id", async () => {
    const definition = {
      challenge: { mode: "alphabet", id: "tabarnia-challenge-02", entries: Array.from({ length: 16 }) },
      levels: Array.from({ length: 16 }),
    };
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    mocks.getLocalAlphabetDemoDefinition.mockResolvedValue(definition);

    const page = await PyramidDemoPage({
      params: Promise.resolve({ challengeId: "tabarnia-challenge-02" }),
    });
    expect(page).toMatchObject({ type: LocalAlphabetGameApp, props: { definition } });
  });

  it("returns 404 for demo identifiers outside the explicit composition allowlist", async () => {
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue(null);
    mocks.getLocalAlphabetDemoDefinition.mockResolvedValue(null);
    mocks.getLocalFlashDemoDefinition.mockResolvedValue(null);
    mocks.getLocalSurvivalDemoDefinition.mockResolvedValue(null);
    mocks.getLocalTimeTrialDemoDefinition.mockResolvedValue(null);
    await expect(
      PyramidDemoPage({ params: Promise.resolve({ challengeId: "tabarnia-challenge-06" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("builds route metadata without checking the publication time window", async () => {
    mocks.getLocalPyramidDemoDefinition.mockResolvedValue({
      challenge: {
        mode: "pyramid",
        title: "Cumbre lógica",
        description: "Sube todo lo que puedas.",
      },
    });
    await expect(
      generateMetadata({ params: Promise.resolve({ challengeId: "tabarnia-challenge-05" }) }),
    ).resolves.toEqual({
      title: "Cumbre lógica — Ensayo local — The Flash",
      description: "Sube todo lo que puedas.",
    });
  });
});
