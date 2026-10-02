"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CompetitiveSessionEngine, type SessionOptions } from "./sessionEngine";
import type { FeedbackChannel } from "./sessionReducer";
export function useCompetitiveSession(options: Omit<SessionOptions, "client" | "refresh">) {
  const router = useRouter();
  const { challenge, roomContext, terminalReview } = options;
  const engine = useMemo(
    () =>
      new CompetitiveSessionEngine({
        challenge,
        roomContext,
        terminalReview,
        refresh: () => router.refresh(),
      }),
    [challenge, roomContext, terminalReview, router],
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
