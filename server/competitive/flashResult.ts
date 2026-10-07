import "server-only";
import type { AuthenticatedActor } from "@/application/ports/actors";
import { SupabaseAttemptCommands } from "@/infrastructure/supabase/attempts/attemptCommands";
import {
  competitivePerformanceObserver,
  observeCompetitiveOperation,
} from "@/infrastructure/observability/competitivePerformance";

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

/** Safe completion projection independent of controller cookies and review assets. */
export async function readTerminalAttemptResult(attemptId: string, identity: AuthenticatedActor) {
  return observeCompetitiveOperation("attempt.readCompletedResult", async () => {
    const saved = await new SupabaseAttemptCommands(identity).readCompletedAttempt(attemptId);
    if (saved) competitivePerformanceObserver.recordRecovery?.("completed_result_recovered");
    return saved;
  });
}

export async function readAbandonedAttemptResult(attemptId: string, identity: AuthenticatedActor) {
  const saved = await new SupabaseAttemptCommands(identity).readAbandonedAttempt(attemptId);
  if (saved?.result.terminalReason === "permission_revoked")
    competitivePerformanceObserver.recordRecovery?.("permission_revoked_result_recovered");
  return saved;
}

export async function readTerminalReviewSafely(attemptId: string) {
  return observeCompetitiveOperation("attempt.readTerminalReview", async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const unavailable = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("review_timeout")), 2000);
      });
      return { review: await Promise.race([readTerminalFlashReview(attemptId), unavailable]) };
    } catch {
      competitivePerformanceObserver.recordRecovery?.("review_pending");
      return { review: [], reviewPending: true as const };
    } finally {
      clearTimeout(timer);
    }
  });
}
