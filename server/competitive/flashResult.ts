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

/** Authorized terminal projection also works after completion revokes the attempt session. */
export async function readTerminalAlphabetResult(attemptId: string) {
  const rows = await supabaseAlphabetQueries.getTerminalReview(attemptId);
  const first = rows[0];
  if (!first) return undefined;
  return {
    scheduledChallengeId: first.scheduled_challenge_id,
    result: {
      attemptId: first.attempt_id,
      lockVersion: first.attempt_lock_version,
      status: "completed" as const,
      score: first.attempt_score,
      answers: rows.map((row) => ({
        challengeItemId: row.challenge_item_id,
        answer: row.answer,
        status: row.answer_status ?? "unanswered",
        points: row.points,
        timeUsedMs: row.time_used_ms,
        resultDetails: row.result_details,
      })),
      review: rows.map((row) => ({
        challengeItemId: row.challenge_item_id,
        publicPayload: row.public_payload,
        solutionPayload: row.solution_payload,
      })),
    },
  };
}
