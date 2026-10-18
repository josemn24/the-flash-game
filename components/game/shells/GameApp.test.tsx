import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { legacyChallenges } from "@/data/mock/legacyChallengeAdapter";
import {
  competitiveChallenges,
  competitiveRoomContext,
  socialSnapshot,
} from "@/test-utils/competitiveGameplay";
import { GameApp } from "./GameApp";
import { CompetitiveGameApp } from "./CompetitiveGameApp";
import { MockGameApp } from "./MockGameApp";

const targets = vi.hoisted(() => ({
  "server-flash": () => null,
  "mock-flash": () => null,
  "server-alphabet": () => null,
  "mock-alphabet": () => null,
  "server-survival": () => null,
  "mock-survival": () => null,
  "server-pyramid": () => null,
  "mock-pyramid": () => null,
  "server-narrative": () => null,
  "mock-narrative": () => null,
  "server-time-trial": () => null,
}));
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => Object.assign(() => null, { load: loader }),
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopGame.client", () => ({
  ServerFlashPopGame: targets["server-flash"],
}));
vi.mock("@/components/game/modes/flash-pop/FlashPopFlashGame.client", () => ({
  FlashPopFlashGame: targets["mock-flash"],
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopAlphabetGame.client", () => ({
  ServerFlashPopAlphabetGame: targets["server-alphabet"],
}));
vi.mock("@/components/game/modes/flash-pop/FlashPopAlphabetGame.client", () => ({
  FlashPopAlphabetGame: targets["mock-alphabet"],
}));
vi.mock("@/components/game/shells/LocalAlphabetGameApp.client", () => ({
  LocalAlphabetGameApp: targets["mock-alphabet"],
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopSurvivalGame.client", () => ({
  ServerFlashPopSurvivalGame: targets["server-survival"],
}));
vi.mock("@/components/game/modes/flash-pop/FlashPopSurvivalGame.client", () => ({
  FlashPopSurvivalGame: targets["mock-survival"],
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopPyramidGame.client", () => ({
  ServerFlashPopPyramidGame: targets["server-pyramid"],
}));
vi.mock("@/components/game/modes/flash-pop/FlashPopPyramidGame.client", () => ({
  FlashPopPyramidGame: targets["mock-pyramid"],
}));
vi.mock("@/components/game/modes/narrative/ServerNarrativeGame.client", () => ({
  ServerNarrativeGame: targets["server-narrative"],
}));
vi.mock("@/components/game/modes/narrative/NarrativeGameApp.client", () => ({
  NarrativeGameApp: targets["mock-narrative"],
}));
vi.mock("@/components/game/modes/flash-pop/ServerFlashPopTimeTrialGame.client", () => ({
  ServerFlashPopTimeTrialGame: targets["server-time-trial"],
}));

async function loadedShell(element: ReactElement) {
  const component = element.type;
  if (
    typeof component !== "function" ||
    !("load" in component) ||
    typeof component.load !== "function"
  ) {
    throw new Error("Expected a dynamically loaded shell");
  }
  return component.load();
}

describe("GameApp routing", () => {
  it.each(competitiveChallenges)(
    "routes competitive $mode and forwards server context",
    async (challenge) => {
      const terminalReview = [{ challengeItemId: "item", publicPayload: {}, solutionPayload: {} }];
      const props = {
        persistence: "server" as const,
        challenge,
        roomContext: competitiveRoomContext,
        socialSnapshot,
        terminalReview,
      };
      expect(GameApp(props).type).toBe(CompetitiveGameApp);
      const element = CompetitiveGameApp(props);
      expect(await loadedShell(element)).toBe(targets[`server-${challenge.mode}`]);
      expect(element.props).toMatchObject({
        challenge,
        roomContext: competitiveRoomContext,
        terminalReview,
      });
      expect(element.props).not.toHaveProperty("onComplete");
    },
  );

  it.each(["flash", "alphabet", "survival", "pyramid", "narrative"] as const)(
    "routes local %s and preserves completion",
    async (mode) => {
      const challenge = legacyChallenges.find((item) => item.mode === mode);
      if (!challenge) throw new Error(`Missing local fixture: ${mode}`);
      const onComplete = vi.fn();
      const props = { persistence: "mock" as const, challenge, socialSnapshot, onComplete };
      expect(GameApp(props).type).toBe(MockGameApp);
      const element = MockGameApp(props);
      expect(await loadedShell(element)).toBe(targets[`mock-${mode}`]);
      if (mode === "alphabet") {
        expect(element.props).toMatchObject({
          definition: { challenge: { mode: "alphabet", id: challenge.id } },
          onComplete,
        });
        expect(element.props.definition.challenge.entries).toHaveLength(16);
      } else {
        expect(element.props).toMatchObject({ challenge, onComplete });
      }
      expect(element.props).not.toHaveProperty("roomContext");
      expect(element.props).not.toHaveProperty("terminalReview");
    },
  );
});
