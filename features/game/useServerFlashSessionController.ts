"use client";
import { useMemo } from "react";
import type { GameRoomContext } from "@/types/view-models/room";
import type {
  FlashChallenge,
  PyramidChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import { deriveSurvivalProgress } from "@/lib/gameplay/survivalProgress";
import { deriveCompetitivePyramidProgress } from "@/lib/gameplay/pyramidProgress";
import { displayChallenge } from "./serverFlashQuestionAdapter";
import {
  isTerminalForServerFlashMode,
  type ServerFlashPlayableChallenge,
} from "./serverFlashModePolicy";
import { useCompetitiveSession } from "./competitive/core/useCompetitiveSession";
import type { SessionPhase } from "./competitive/core/sessionReducer";
export type ServerFlashPhase = Exclude<SessionPhase, "scene">;
/** Compatibility facade for the three Flash presentations. */
export function useServerFlashSession(options: {
  challenge: ServerFlashPlayableChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
  const { challenge } = options;
  const display = useMemo(() => displayChallenge(challenge), [challenge]);
  return {
    ...session,
    phase: session.phase as ServerFlashPhase,
    question: session.question as ServerFlashQuestion | null,
    reviewChallenge: session.reviewChallenge as FlashChallenge | PyramidChallenge | null,
    displayChallenge: display,
    isTerminalQuestion: isTerminalForServerFlashMode(
      challenge,
      session.questionIndex,
      session.results,
    ),
    survivalProgress:
      challenge.mode === "survival"
        ? deriveSurvivalProgress(challenge.lives, challenge.slots.length, session.results)
        : null,
    pyramidProgress:
      challenge.mode === "pyramid"
        ? deriveCompetitivePyramidProgress(challenge.levels.length, session.results)
        : null,
  };
}
export type ServerFlashSession = ReturnType<typeof useServerFlashSession>;
