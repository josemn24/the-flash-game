import { describe, expect, it, vi } from "vitest";
import type { CompetitiveChallengePageModel, QueryContext } from "@/types/view-models";
import {
  CompetitiveChallengeModeReader,
  SupabaseCompetitiveChallengeQueries,
} from "./competitiveChallengeQueries";

const challengeKey = "00000000-0000-4000-8000-000000000001";
const context = {
  viewer: {
    playerId: "player-1",
    id: "player",
    name: "Player",
    avatarSrc: undefined,
  },
  now: "2026-09-30T10:00:00.000Z",
} as QueryContext;

function model(mode: string): CompetitiveChallengePageModel {
  return {
    challenge: { mode } as CompetitiveChallengePageModel["challenge"],
  } as CompetitiveChallengePageModel;
}

function reader(result: CompetitiveChallengePageModel | null): CompetitiveChallengeModeReader {
  return { getPlayable: vi.fn().mockResolvedValue(result) };
}

function readers(
  overrides: Partial<Record<keyof typeof defaultReaders, CompetitiveChallengeModeReader>> = {},
) {
  return {
    ...defaultReaders,
    ...overrides,
  };
}

const defaultReaders = {
  flash: reader(null),
  alphabet: reader(null),
  survival: reader(null),
  pyramid: reader(null),
};

describe("SupabaseCompetitiveChallengeQueries", () => {
  it("tries Flash, Alphabet, Survival and Pyramid in order until one matches", async () => {
    const flash = reader(null);
    const alphabet = reader(null);
    const survival = reader(model("survival"));
    const pyramid = reader(model("pyramid"));
    const queries = new SupabaseCompetitiveChallengeQueries(
      readers({ flash, alphabet, survival, pyramid }),
    );

    await expect(queries.getPlayable("room", challengeKey, context)).resolves.toMatchObject({
      challenge: { mode: "survival" },
    });
    expect(flash.getPlayable).toHaveBeenCalledWith("room", challengeKey, context);
    expect(alphabet.getPlayable).toHaveBeenCalledWith("room", challengeKey, context);
    expect(survival.getPlayable).toHaveBeenCalledWith("room", challengeKey, context);
    expect(pyramid.getPlayable).not.toHaveBeenCalled();
  });

  it("returns the first matching mode and forwards the same query context", async () => {
    const flash = reader(model("flash"));
    const alphabet = reader(model("alphabet"));
    const queries = new SupabaseCompetitiveChallengeQueries(readers({ flash, alphabet }));

    const result = await queries.getPlayable("room", challengeKey, context);

    expect(result).toMatchObject({ challenge: { mode: "flash" } });
    expect(flash.getPlayable).toHaveBeenCalledTimes(1);
    expect(alphabet.getPlayable).not.toHaveBeenCalled();
    expect((flash.getPlayable as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toBe(context);
  });

  it("propagates a Supabase reader error without trying a mock fallback", async () => {
    const error = new Error("Supabase mode read failed");
    const flash: CompetitiveChallengeModeReader = {
      getPlayable: vi.fn().mockRejectedValue(error),
    };
    const alphabet = reader(model("alphabet"));
    const queries = new SupabaseCompetitiveChallengeQueries(readers({ flash, alphabet }));

    await expect(queries.getPlayable("room", challengeKey, context)).rejects.toBe(error);
    expect(alphabet.getPlayable).not.toHaveBeenCalled();
  });

  it("returns null when every mode returns null", async () => {
    const flash = reader(null);
    const alphabet = reader(null);
    const survival = reader(null);
    const pyramid = reader(null);
    const queries = new SupabaseCompetitiveChallengeQueries(
      readers({ flash, alphabet, survival, pyramid }),
    );

    await expect(queries.getPlayable("room", challengeKey, context)).resolves.toBeNull();
    expect(flash.getPlayable).toHaveBeenCalledTimes(1);
    expect(alphabet.getPlayable).toHaveBeenCalledTimes(1);
    expect(survival.getPlayable).toHaveBeenCalledTimes(1);
    expect(pyramid.getPlayable).toHaveBeenCalledTimes(1);
  });

  it("does not query any mode for an invalid route key", async () => {
    const flash = reader(model("flash"));
    const queries = new SupabaseCompetitiveChallengeQueries(readers({ flash }));

    await expect(queries.getPlayable("room", "not-a-publication", context)).resolves.toBeNull();
    expect(flash.getPlayable).not.toHaveBeenCalled();
  });
});
