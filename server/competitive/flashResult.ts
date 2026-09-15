import "server-only";

import { supabaseFlashQueries } from "@/infrastructure/supabase/flashQueries";

export function readTerminalFlashReview(attemptId: string) {
  return supabaseFlashQueries.getTerminalReview(attemptId);
}
