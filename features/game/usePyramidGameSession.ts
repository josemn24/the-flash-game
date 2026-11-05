"use client";

import { useMemo } from "react";
import type { GameSessionProvider } from "@/application/ports/game-session";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import type { ServerFlashQuestion, ServerPyramidChallenge } from "@/types/gameplay/challenge";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { SessionClock } from "@/application/ports/game-session";
import { useCompetitiveSessionWithProvider } from "./competitive/core/useCompetitiveSession";

/**
 * Provider-neutral Pyramid presentation adapter. The view receives public
 * challenge/session state and competitive controls; transport composition stays
 * with the caller.
 */
export function usePyramidGameSession(options: {
  readonly challenge: ServerPyramidChallenge;
  readonly provider: GameSessionProvider;
  readonly initialSession: GameSessionBootstrap;
  readonly clock?: SessionClock;
  readonly refresh?: () => void;
}) {
  const { challenge, provider, initialSession, clock, refresh } = options;
  const session = useCompetitiveSessionWithProvider({
    challenge,
    provider,
    initialSession,
    clock,
    refresh,
  });
  const questionInput = useMemo(() => createCompetitiveInput(session), [session]);
  const pyramidProgress = useMemo(
    () => deriveCompetitivePyramidProgress(challenge.levels.length, session.results),
    [challenge.levels.length, session.results],
  );
  return {
    ...session,
    phase: session.phase,
    question: session.question as ServerFlashQuestion | null,
    questionInput,
    pyramidProgress,
    isTerminalQuestion: pyramidProgress.outcome !== "in_progress",
  };
}

export type PyramidGameSession = ReturnType<typeof usePyramidGameSession>;
