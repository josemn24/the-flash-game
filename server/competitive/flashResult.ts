import "server-only";

import { supabaseFlashQueries } from "@/infrastructure/supabase/gameplay/flashQueries";
import { supabaseAlphabetQueries } from "@/infrastructure/supabase/gameplay/alphabetQueries";
import { supabaseSurvivalQueries } from "@/infrastructure/supabase/gameplay/survivalQueries";
import { supabasePyramidQueries } from "@/infrastructure/supabase/gameplay/pyramidQueries";
import { supabaseNarrativeQueries } from "@/infrastructure/supabase/gameplay/narrativeQueries";

export async function readTerminalFlashReview(attemptId: string) {
  const flashReview = await supabaseFlashQueries.getTerminalReview(attemptId);
  if (flashReview.length) return flashReview;
  const alphabetRows = await supabaseAlphabetQueries.getTerminalReview(attemptId);
  if (alphabetRows.length)
    return alphabetRows.map((row) => ({
      challengeItemId: row.challenge_item_id,
      publicPayload: row.public_payload,
      solutionPayload: row.solution_payload,
    }));
  const survivalReview = await supabaseSurvivalQueries.getTerminalReview(attemptId);
  if (survivalReview.length) return survivalReview;
  const pyramidReview = await supabasePyramidQueries.getTerminalReview(attemptId);
  if (pyramidReview.length) return pyramidReview;
  return supabaseNarrativeQueries.getTerminalReview(attemptId);
}
