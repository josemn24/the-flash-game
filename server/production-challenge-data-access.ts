import "server-only";

import { cache } from "react";
import { supabaseFlashQueries } from "@/infrastructure/supabase/gameplay/flashQueries";
import { supabaseAlphabetQueries } from "@/infrastructure/supabase/gameplay/alphabetQueries";
import { supabaseSurvivalQueries } from "@/infrastructure/supabase/gameplay/survivalQueries";
import { supabasePyramidQueries } from "@/infrastructure/supabase/gameplay/pyramidQueries";

export const getPlayableChallengePageModel = cache(
  async (challengeKey: string, roomKey: string | null = null) => {
    if (!roomKey || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(challengeKey)) return null;
    return (
      (await supabaseFlashQueries.getPlayable(roomKey, challengeKey)) ??
      (await supabaseAlphabetQueries.getPlayable(roomKey, challengeKey)) ??
      (await supabaseSurvivalQueries.getPlayable(roomKey, challengeKey)) ??
      supabasePyramidQueries.getPlayable(roomKey, challengeKey)
    );
  },
);
