"use client";

import { sessionValidationContext } from "../../session/sessionResult";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CompetitiveSessionEngine, type SessionOptions } from "./sessionEngine";
import type { FeedbackChannel } from "./sessionReducer";
import type { GameRoomContext } from "@/types/view-models/room";
import type { ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import { createRemoteGameSessionProvider } from "../../session/providers/remote";
import { remoteSessionBootstrap } from "../../session/providers/remoteBootstrap";

type CompetitiveSessionOptions = Pick<SessionOptions, "challenge"> & {
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
};

/** Shared React adapter for a session with an explicitly composed runtime. */
export function useCompetitiveSessionWithProvider(options: SessionOptions) {
  const { challenge, initialSession, provider, clock, refresh } = options;
  const engine = useMemo(
    () => new CompetitiveSessionEngine({ challenge, initialSession, provider, clock, refresh }),
    [challenge, initialSession, provider, clock, refresh],
  );
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => engine.connect(), [engine]);
  useEffect(() => {
    if (
      challenge.mode !== "pyramid" ||
      state.phase !== "preparing" ||
      !state.question ||
      state.pendingCommand ||
      state.lifecycleError
    )
      return;
    const frame = window.requestAnimationFrame(() => {
      void engine.lifecycle.activate();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    challenge.mode,
    engine,
    state.phase,
    state.question,
    state.pendingCommand,
    state.lifecycleError,
  ]);
  const feedback = (channel: FeedbackChannel) =>
    state.feedback?.channel === channel ? state.feedback : undefined;
  const submission = feedback("submission");
  const verification = feedback("answerVerification");
  const reveal = feedback("reveal");
  const queens = feedback("queens");
  const wordSearch = feedback("wordSearch");
  return {
    ...state,
    submissionState: submission?.state ?? "idle",
    submissionStatusVisible: submission?.visible ?? false,
    submissionError: submission?.message,
    answerVerificationState: verification?.state ?? "idle",
    answerVerificationStatusVisible: verification?.visible ?? false,
    answerVerificationError: verification?.message,
    revealState: reveal?.state ?? "idle",
    revealStatusVisible: reveal?.visible ?? false,
    revealError: reveal?.message,
    queensState: queens?.state ?? "idle",
    queensStatusVisible: queens?.visible ?? false,
    queensError: queens?.message,
    wordSearchState: wordSearch?.state ?? "idle",
    wordSearchStatusVisible: wordSearch?.visible ?? false,
    wordSearchError: wordSearch?.message,
    ...engine.interactions,
    begin: engine.lifecycle.begin,
    takeOver: engine.takeOver,
    cancelTakeOver: engine.cancelTakeOver,
    startQuestions: engine.startQuestions,
    continueScene: engine.continueScene,
    handleTimeUp: () => engine.interactions.onTimeUp(state.question?.id),
    onTimeUp: () => engine.interactions.onTimeUp(state.question?.id),
    retrySubmit: engine.retry,
    retryReveal: engine.retry,
    retryQueensValidation: engine.retry,
    retryWordSearchSelection: engine.retry,
    retryLifecycle: engine.retry,
    retryRecovery: engine.reconcile,
    abandon: engine.abandon,
    showReview: engine.showReview,
    showResults: engine.showResults,
  };
}

export function useCompetitiveSession(options: CompetitiveSessionOptions) {
  const router = useRouter();
  const { challenge, roomContext, terminalReview } = options;
  const provider = useMemo(
    () => createRemoteGameSessionProvider({ context: sessionValidationContext(challenge) }),
    [challenge],
  );
  const initialSession = useMemo(
    () => remoteSessionBootstrap(roomContext, terminalReview),
    [roomContext, terminalReview],
  );
  const refresh = useMemo(() => () => router.refresh(), [router]);
  return useCompetitiveSessionWithProvider({
    challenge,
    initialSession,
    provider,
    refresh,
  });
}
