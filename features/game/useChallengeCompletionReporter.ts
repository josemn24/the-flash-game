"use client";

import { useEffect, useRef } from "react";
import type { ChallengeCompletionInput, ChallengeCompletionResult } from "@/types/game";

export function useChallengeCompletionReporter(
  result: ChallengeCompletionInput | null,
  onComplete?: (result: ChallengeCompletionResult) => void,
) {
  const reportedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!result) {
      reportedKey.current = null;
      return;
    }

    const key = `${result.challengeId}:${result.points}:${result.completed}`;
    if (reportedKey.current === key) return;

    reportedKey.current = key;
    onComplete?.({ ...result, playedAt: new Date().toISOString() });
  }, [onComplete, result]);
}
