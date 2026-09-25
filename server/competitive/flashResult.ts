import "server-only";

import { supabaseFlashQueries } from "@/infrastructure/supabase/flashQueries";
import { supabaseAlphabetQueries } from "@/infrastructure/supabase/alphabetQueries";

export async function readTerminalFlashReview(attemptId: string) {
  const flashReview = await supabaseFlashQueries.getTerminalReview(attemptId);
  if (flashReview.length) return flashReview;
  const alphabetRows = await supabaseAlphabetQueries.getTerminalReview(attemptId);
  return alphabetRows.map((row) => ({
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  }));
}
