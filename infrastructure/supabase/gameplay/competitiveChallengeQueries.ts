import "server-only";

import type { CompetitiveChallengeQueries } from "@/application/queries";
import type { CompetitiveChallengePageModel, QueryContext } from "@/types/view-models";
import { supabaseAlphabetQueries } from "./alphabetQueries";
import { supabaseFlashQueries } from "./flashQueries";
import { supabasePyramidQueries } from "./pyramidQueries";
import { supabaseSurvivalQueries } from "./survivalQueries";

const publicationKeyPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export type CompetitiveChallengeModeReader = {
  getPlayable(
    roomKey: string,
    challengeKey: string,
    context: QueryContext,
  ): Promise<CompetitiveChallengePageModel | null>;
};

export type SupabaseCompetitiveChallengeReaders = {
  readonly flash: CompetitiveChallengeModeReader;
  readonly alphabet: CompetitiveChallengeModeReader;
  readonly survival: CompetitiveChallengeModeReader;
  readonly pyramid: CompetitiveChallengeModeReader;
};

export class SupabaseCompetitiveChallengeQueries implements CompetitiveChallengeQueries {
  constructor(private readonly readers: SupabaseCompetitiveChallengeReaders) {}

  async getPlayable(roomKey: string, challengeKey: string, context: QueryContext) {
    if (!roomKey || !publicationKeyPattern.test(challengeKey)) return null;

    for (const reader of [
      this.readers.flash,
      this.readers.alphabet,
      this.readers.survival,
      this.readers.pyramid,
    ]) {
      const model = await reader.getPlayable(roomKey, challengeKey, context);
      if (model) return model;
    }

    return null;
  }
}

export const supabaseCompetitiveChallengeQueries = new SupabaseCompetitiveChallengeQueries({
  flash: supabaseFlashQueries,
  alphabet: supabaseAlphabetQueries,
  survival: supabaseSurvivalQueries,
  pyramid: supabasePyramidQueries,
});
