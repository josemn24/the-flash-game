"use client";

import { useMemo } from "react";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";
import type {
  FlashChallenge,
  ServerFlashQuestion,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { useCompetitiveSessionWithProvider } from "./competitive/core/useCompetitiveSession";
import type { SessionPhase } from "./competitive/core/sessionReducer";

/** Provider-neutral Survival presentation adapter for local and remote sessions. */
export function useSurvivalGameSession(options: {
  readonly challenge: ServerSurvivalChallenge;
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
  const survivalProgress = useMemo(
    () => deriveSurvivalProgress(challenge.lives, challenge.slots.length, session.results),
    [challenge.lives, challenge.slots.length, session.results],
  );
  return {
    ...session,
    phase: session.phase as Exclude<SessionPhase, "scene">,
    question: session.question as ServerFlashQuestion | null,
    questionInput,
    reviewChallenge: session.reviewChallenge as FlashChallenge | null,
    survivalProgress,
    isTerminalQuestion: survivalProgress.outcome !== "in_progress",
  };
}

export type SurvivalGameSession = ReturnType<typeof useSurvivalGameSession>;
