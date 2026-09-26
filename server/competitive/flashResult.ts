import "server-only";

import { supabaseFlashQueries } from "@/infrastructure/supabase/flashQueries";
import { supabaseAlphabetQueries } from "@/infrastructure/supabase/alphabetQueries";
import { supabaseSurvivalQueries } from "@/infrastructure/supabase/survivalQueries";
import { supabasePyramidQueries } from "@/infrastructure/supabase/pyramidQueries";

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
  return supabasePyramidQueries.getTerminalReview(attemptId);
}
