"use client";

import { useEffect, useRef } from "react";
import type { ChallengeCompletion } from "@/types/game";

type CompletionPayload = Omit<ChallengeCompletion, "roomId">;

export function useChallengeCompletionReporter(
  result: CompletionPayload | null,
  onComplete?: (result: CompletionPayload) => void,
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
    onComplete?.(result);
  }, [onComplete, result]);
}
