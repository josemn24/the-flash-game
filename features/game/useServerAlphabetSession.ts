"use client";
import type { GameRoomContext } from "@/types/view-models/room";
import type {
  AlphabetChallenge,
  ServerAlphabetChallenge,
  ServerAlphabetQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import { useCompetitiveSession } from "./competitive/core/useCompetitiveSession";
export type ServerAlphabetPhase =
  "intro" | "recovering" | "countdown" | "playing" | "finalizing" | "results" | "review";
export function useServerAlphabetSession(options: {
  challenge: ServerAlphabetChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
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
