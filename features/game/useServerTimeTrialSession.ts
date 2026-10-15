"use client";

import type {
  ServerTimeTrialChallenge,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import type { GameRoomContext } from "@/types/view-models/room";
import { createCompetitiveInput } from "@/features/question-formats/createCompetitiveInput";
import { useCompetitiveSession } from "./competitive/core/useCompetitiveSession";

/** Keeps the global timer controller independent of the question presentation contract. */
export function useServerTimeTrialSession(options: {
  challenge: ServerTimeTrialChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
  return { ...session, questionInput: createCompetitiveInput(session) };
}
