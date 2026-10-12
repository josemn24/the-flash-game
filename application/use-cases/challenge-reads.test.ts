import { describe, expect, it, vi } from "vitest";
import type { CompetitiveChallengeQueries, DemoChallengeQueries } from "@/application/queries";
import {
  ApplicationCompetitiveChallengeReads,
  ApplicationDemoChallengeReads,
} from "@/application/use-cases/challenge-reads";
import type { QueryContext, ViewerProfile } from "@/types/view-models";

const viewer: ViewerProfile = {
  playerId: "canonical-player" as ViewerProfile["playerId"],
  id: "route-player",
  name: "Ana",
};

const clock = { now: vi.fn(() => "2026-10-01T10:00:00.000Z" as QueryContext["now"]) };

describe("Application challenge reads", () => {
  it("keeps demo previews separate from competitive reads", async () => {
    const currentViewer = { getCurrentViewer: vi.fn(async () => viewer) };
    const demo: DemoChallengeQueries = {
      getPreview: vi.fn(async () => null),
      getFlashPopLobby: vi.fn(async () => {
        throw new Error("not used");
      }),
    };
    const competitive: CompetitiveChallengeQueries = {
      getPlayable: vi.fn(async () => null),
    };
    const demoReads = new ApplicationDemoChallengeReads({ currentViewer, queries: demo, clock });
    const competitiveReads = new ApplicationCompetitiveChallengeReads({
      currentViewer,
      queries: competitive,
      clock,
    });

    await demoReads.getPreview("demo-challenge");
    await competitiveReads.getPlayable("room-key", "competitive-challenge");

    expect(demo.getPreview).toHaveBeenCalledWith("demo-challenge", {
      viewer,
      now: "2026-10-01T10:00:00.000Z",
    });
    expect(competitive.getPlayable).toHaveBeenCalledWith(
      "room-key",
      "competitive-challenge",
      expect.objectContaining({ viewer }),
    );
  });

  it("does not provide a demo fallback when the competitive adapter fails", async () => {
    const competitive: CompetitiveChallengeQueries = {
      getPlayable: vi.fn(async () => {
        throw new Error("supabase unavailable");
      }),
    };
    const reads = new ApplicationCompetitiveChallengeReads({
      currentViewer: { getCurrentViewer: vi.fn(async () => viewer) },
      queries: competitive,
      clock,
    });

    await expect(reads.getPlayable("room-key", "challenge-key")).rejects.toThrow(
      "supabase unavailable",
    );
  });

  it("returns null before any port call without an authenticated viewer", async () => {
    const queries: CompetitiveChallengeQueries = { getPlayable: vi.fn(async () => null) };
    const reads = new ApplicationCompetitiveChallengeReads({
      currentViewer: { getCurrentViewer: vi.fn(async () => null) },
      queries,
      clock,
    });

    await expect(reads.getPlayable("room-key", "challenge-key")).resolves.toBeNull();
    expect(queries.getPlayable).not.toHaveBeenCalled();
  });
});
