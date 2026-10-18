"use client";

import type {
  ServerTimeTrialChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionBootstrap } from "@/types/gameplay/authoritative-session";
import type { GameRoomContext } from "@/types/view-models/room";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import {
  useCompetitiveSession,
  useCompetitiveSessionWithProvider,
} from "./competitive/core/useCompetitiveSession";

function withQuestionInput<T extends ReturnType<typeof useCompetitiveSession>>(session: T) {
  return { ...session, questionInput: createCompetitiveInput(session) };
}

/** Keeps the global timer controller independent of the question presentation contract. */
export function useServerTimeTrialSession(options: {
  challenge: ServerTimeTrialChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
  return withQuestionInput(session);
}

/** Provider-neutral adapter used by the local rehearsal and the competitive view. */
export function useTimeTrialGameSession(options: {
  challenge: ServerTimeTrialChallenge;
  provider: GameSessionProvider;
  initialSession: GameSessionBootstrap;
  clock?: SessionClock;
}) {
  const session = useCompetitiveSessionWithProvider(options);
  return withQuestionInput(session);
}
