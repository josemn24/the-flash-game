"use client";
import { useMemo } from "react";
import type { GameRoomContext } from "@/types/view-models/room";
import type {
  FlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerNarrativeChallenge,
} from "@/types/gameplay/challenge";
import { useCompetitiveSession } from "./competitive/core/useCompetitiveSession";
import { narrativePolicy } from "./competitive/modes/narrative";
export type ServerNarrativePhase =
  | "intro"
  | "recovering"
  | "scene"
  | "preparing"
  | "playing"
  | "checking"
  | "transition"
  | "results"
  | "review";
export function useServerNarrativeSession(options: {
  challenge: ServerNarrativeChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useCompetitiveSession(options);
  const { challenge } = options;
  const sequence = useMemo(() => narrativePolicy(challenge).sequence, [challenge]);
  // The narrative stage uses submission feedback for generic and incremental answers.
  const submission =
    session.feedback?.channel === "answerVerification" ? session.feedback : undefined;
  return {
    ...session,
    phase: session.phase as ServerNarrativePhase,
    question: session.question as ServerFlashQuestion | null,
    reviewChallenge: session.reviewChallenge as FlashChallenge | null,
    currentStep: sequence[session.stepIndex],
    questionNumber: sequence
      .slice(0, session.stepIndex + 1)
      .filter((step) => step.type === "question").length,
    submissionState: submission?.state ?? session.submissionState,
    submissionStatusVisible: submission?.visible ?? session.submissionStatusVisible,
    submissionError: submission?.message ?? session.submissionError,
  };
}
