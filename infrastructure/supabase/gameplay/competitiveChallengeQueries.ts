import {
  observeCompetitiveOperation,
  competitivePerformanceObserver,
  countCompetitiveDatabaseCall,
} from "@/infrastructure/observability/competitivePerformance";
import "server-only";

import type { CompetitiveChallengeQueries } from "@/application/queries";
import type { CompetitiveChallengePageModel, QueryContext } from "@/types/view-models";
import { createClient } from "@/infrastructure/supabase/auth/server-client";
import { readCompetitiveProjection } from "./competitiveReadProjection";
import { supabaseAlphabetQueries } from "./alphabetQueries";
import { supabaseFlashQueries } from "./flashQueries";
import { supabasePyramidQueries } from "./pyramidQueries";
import { supabaseSurvivalQueries } from "./survivalQueries";
import { supabaseNarrativeQueries } from "./narrativeQueries";

const publicationKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CompetitiveChallengeModeReader = {
  getPlayableFromRows(
    rows: readonly unknown[],
    context: QueryContext,
  ): Promise<CompetitiveChallengePageModel | null>;
};

export type SupabaseCompetitiveChallengeReaders = {
  readonly flash: CompetitiveChallengeModeReader;
  readonly alphabet: CompetitiveChallengeModeReader;
  readonly survival: CompetitiveChallengeModeReader;
  readonly pyramid: CompetitiveChallengeModeReader;
  readonly narrative: CompetitiveChallengeModeReader;
};

export class SupabaseCompetitiveChallengeQueries implements CompetitiveChallengeQueries {
  constructor(
    private readonly readers: SupabaseCompetitiveChallengeReaders,
    private readonly readProjection: (
      roomKey: string,
      challengeKey: string,
    ) => Promise<unknown> = callCompetitiveChallengeRead,
  ) {}

  async getPlayable(roomKey: string, challengeKey: string, context: QueryContext) {
    if (!roomKey || !publicationKeyPattern.test(challengeKey)) return null;

    return observeCompetitiveOperation("challenge.read", async () => {
      const projection = readCompetitiveProjection(
        await competitivePerformanceObserver.measure("challenge.initial", () =>
          this.readProjection(roomKey, challengeKey),
        ),
      );
      if (!projection) return null;
      competitivePerformanceObserver.setMode(projection.mode);
      if (
        projection.rows.some((row) => {
          const fields = row as Record<string, unknown>;
          return (
            fields.room_slug !== roomKey ||
            typeof fields.publication_id !== "string" ||
            fields.publication_id.toLowerCase() !== challengeKey.toLowerCase()
          );
        })
      )
        throw new Error("Inconsistent competitive challenge route");
      return competitivePerformanceObserver.measure("challenge.enrichment", () =>
        this.readers[projection.mode].getPlayableFromRows(projection.rows, context),
      );
    });
  }
}

async function callCompetitiveChallengeRead(roomKey: string, challengeKey: string) {
  const supabase = await createClient();
  countCompetitiveDatabaseCall("rpcCalls");
  const { data, error } = await supabase.rpc("get_my_competitive_challenge", {
    target_room_slug: roomKey,
    target_publication_id: challengeKey,
  });
  if (error) throw new Error(`Supabase competitive read failed: ${error.message}`);
  return data;
}

export const supabaseCompetitiveChallengeQueries = new SupabaseCompetitiveChallengeQueries({
  flash: supabaseFlashQueries,
  alphabet: supabaseAlphabetQueries,
  survival: supabaseSurvivalQueries,
  pyramid: supabasePyramidQueries,
  narrative: supabaseNarrativeQueries,
});
