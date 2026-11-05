"use client";

import { useMemo } from "react";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import type {
  FlashChallenge,
  ServerFlashChallenge,
  ServerFlashQuestion,
} from "@/types/gameplay/challenge";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import { useCompetitiveSessionWithProvider } from "./competitive/core/useCompetitiveSession";
import type { SessionPhase } from "./competitive/core/sessionReducer";

export function useFlashGameSession(options: {
  readonly challenge: ServerFlashChallenge;
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
  return {
    ...session,
    phase: session.phase as Exclude<SessionPhase, "scene">,
    question: session.question as ServerFlashQuestion | null,
    questionInput,
    reviewChallenge: session.reviewChallenge as FlashChallenge | null,
    isTerminalQuestion: session.questionIndex >= challenge.slots.length - 1,
  };
}

export type FlashGameSession = ReturnType<typeof useFlashGameSession>;
