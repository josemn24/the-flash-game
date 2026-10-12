import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameMode } from "@/types/domain/content";
import type { CompetitiveChallengePageModel, QueryContext } from "@/types/view-models";
import { SupabaseCompetitiveChallengeQueries } from "./competitiveChallengeQueries";
import { supabaseAlphabetQueries } from "./alphabetQueries";
import { supabaseFlashQueries } from "./flashQueries";
import { supabaseSurvivalQueries } from "./survivalQueries";
import { supabasePyramidQueries } from "./pyramidQueries";
import { supabaseNarrativeQueries } from "./narrativeQueries";

const clientMocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/infrastructure/supabase/auth/server-client", () => ({
  createClient: async () => clientMocks,
}));
const challengeKey = "abcdef12-0000-4000-8000-abcdef123456";
const context = {
  viewer: { playerId: "player-1", name: "Player" },
  now: "2026-09-30T10:00:00.000Z",
} as QueryContext;
const modes: GameMode[] = ["flash", "alphabet", "survival", "pyramid", "narrative"];
function projection(mode: GameMode) {
  return {
    mode,
    rows: [{ challenge_mode: mode, room_slug: "room", publication_id: challengeKey }],
  };
}
function readers() {
  return Object.fromEntries(
    modes.map((mode) => [
      mode,
      {
        getPlayableFromRows: vi
          .fn()
          .mockResolvedValue({ challenge: { mode } } as CompetitiveChallengePageModel),
      },
    ]),
  ) as Record<GameMode, { getPlayableFromRows: ReturnType<typeof vi.fn> }>;
}

beforeEach(() => vi.clearAllMocks());
describe("SupabaseCompetitiveChallengeQueries", () => {
  it.each(modes)("uses exactly one initial RPC and only the %s builder", async (mode) => {
    const builders = readers();
    const envelope = projection(mode);
    clientMocks.rpc.mockResolvedValue({ data: envelope, error: null });
    const query = new SupabaseCompetitiveChallengeQueries(builders);
    await expect(query.getPlayable("room", challengeKey, context)).resolves.toMatchObject({
      challenge: { mode },
    });
    expect(clientMocks.rpc).toHaveBeenCalledExactlyOnceWith("get_my_competitive_challenge", {
      target_room_slug: "room",
      target_publication_id: challengeKey,
    });
    expect(builders[mode].getPlayableFromRows).toHaveBeenCalledExactlyOnceWith(
      envelope.rows,
      context,
    );
    for (const other of modes.filter((value) => value !== mode))
      expect(builders[other].getPlayableFromRows).not.toHaveBeenCalled();
  });

  it("preserves authorized absence without selecting a builder", async () => {
    clientMocks.rpc.mockResolvedValue({ data: null, error: null });
    const builders = readers();
    await expect(
      new SupabaseCompetitiveChallengeQueries(builders).getPlayable("room", challengeKey, context),
    ).resolves.toBeNull();
    for (const builder of Object.values(builders))
      expect(builder.getPlayableFromRows).not.toHaveBeenCalled();
  });

  it("accepts uppercase UUID route keys with canonical SQL identifiers", async () => {
    clientMocks.rpc.mockResolvedValue({ data: projection("flash"), error: null });
    await expect(
      new SupabaseCompetitiveChallengeQueries(readers()).getPlayable(
        "room",
        challengeKey.toUpperCase(),
        context,
      ),
    ).resolves.toMatchObject({ challenge: { mode: "flash" } });
  });

  it("propagates infrastructure and enrichment errors", async () => {
    clientMocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(
      new SupabaseCompetitiveChallengeQueries(readers()).getPlayable("room", challengeKey, context),
    ).rejects.toThrow("unavailable");
    clientMocks.rpc.mockResolvedValue({ data: projection("flash"), error: null });
    const builders = readers();
    const error = new Error("asset failure");
    builders.flash.getPlayableFromRows.mockRejectedValue(error);
    await expect(
      new SupabaseCompetitiveChallengeQueries(builders).getPlayable("room", challengeKey, context),
    ).rejects.toBe(error);
  });

  it.each([
    undefined,
    [],
    {},
    { mode: "other", rows: [{}] },
    { mode: "flash", rows: [] },
    { mode: "flash", rows: {} },
    { mode: "flash", rows: [null] },
    { mode: "flash", rows: projection("alphabet").rows },
    { ...projection("flash"), rows: [...projection("flash").rows, ...projection("alphabet").rows] },
    { ...projection("flash"), rows: [{ ...projection("flash").rows[0], room_slug: "wrong" }] },
  ])("rejects malformed or inconsistent envelopes %#", async (data) => {
    clientMocks.rpc.mockResolvedValue({ data, error: null });
    const builders = readers();
    await expect(
      new SupabaseCompetitiveChallengeQueries(builders).getPlayable("room", challengeKey, context),
    ).rejects.toThrow();
    for (const builder of Object.values(builders))
      expect(builder.getPlayableFromRows).not.toHaveBeenCalled();
  });

  it.each([
    supabaseFlashQueries,
    supabaseAlphabetQueries,
    supabaseSurvivalQueries,
    supabasePyramidQueries,
    supabaseNarrativeQueries,
  ])("rejects malformed rows with the existing mode guard %#", async (builder) => {
    await expect(builder.getPlayableFromRows([{}], context)).rejects.toThrow(
      "Invalid competitive challenge rows",
    );
    expect(clientMocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["room", "bad-key"],
    ["", challengeKey],
  ])("avoids reads for invalid routes", async (room, key) => {
    await expect(
      new SupabaseCompetitiveChallengeQueries(readers()).getPlayable(room, key, context),
    ).resolves.toBeNull();
    expect(clientMocks.rpc).not.toHaveBeenCalled();
  });
});
