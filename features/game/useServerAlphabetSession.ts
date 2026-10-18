"use client";
import type { GameRoomContext } from "@/types/view-models/room";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type {
  AlphabetChallenge,
  ServerAlphabetChallenge,
  ServerAlphabetQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import { useCompetitiveSession } from "./competitive/core/useCompetitiveSession";
import { useCompetitiveSessionWithProvider } from "./competitive/core/useCompetitiveSession";
export type ServerAlphabetPhase =
  "intro" | "recovering" | "countdown" | "playing" | "finalizing" | "results" | "review";

function adaptAlphabetSession(session: ReturnType<typeof useCompetitiveSession>) {
  return {
    ...session,
    phase: (session.phase === "preparing" ||
    session.phase === "checking" ||
    session.phase === "transition"
      ? "playing"
      : session.phase) as ServerAlphabetPhase,
    question: session.question as ServerAlphabetQuestion | null,
    reviewChallenge: session.reviewChallenge as AlphabetChallenge | null,
    error: session.lifecycleError?.message ?? session.answerVerificationError,
  };
}

export function useServerAlphabetSession(options: {
  challenge: ServerAlphabetChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
  return adaptAlphabetSession(session);
}

/** Provider-neutral adapter shared by local rehearsals and the competitive view. */
export function useAlphabetGameSession(options: {
  challenge: ServerAlphabetChallenge;
  provider: GameSessionProvider;
  initialSession: GameSessionBootstrap;
  clock?: SessionClock;
}) {
  const session = useCompetitiveSessionWithProvider(options);
  return adaptAlphabetSession(session);
}
