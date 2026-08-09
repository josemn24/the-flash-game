"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  getNarrativeReaction,
  getNarrativeSequence,
  initialNarrativeSessionState,
  narrativeSessionReducer,
} from "@/features/narrative/narrativeSession";
import { calculateTotalScore, evaluateAnswer, getTimedOutAnswer } from "@/lib/scoring";
import type { AnswerValue, NarrativeChallenge } from "@/types/game";

const TRANSITION_DURATION = 650;

export function useNarrativeSession(challenge: NarrativeChallenge) {
  const sequence = useMemo(() => getNarrativeSequence(challenge), [challenge]);
  const [state, dispatch] = useReducer(narrativeSessionReducer, initialNarrativeSessionState);
  const questionStartedAt = useRef(0);
  const answerLock = useRef(false);
  const draftAnswerRef = useRef<AnswerValue | null>(null);
  const incorrectAttemptsRef = useRef(0);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStep = sequence[state.stepIndex];

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeout.current) {
      clearTimeout(advanceTimeout.current);
      advanceTimeout.current = null;
    }
  }, []);

  useEffect(() => clearAdvanceTimeout, [clearAdvanceTimeout]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase, state.stepIndex]);

  const prepareNextStep = useCallback(
    (nextIndex: number) => {
      const nextStep = sequence[nextIndex];
      if (nextStep?.type === "question") {
        answerLock.current = false;
        draftAnswerRef.current = null;
        incorrectAttemptsRef.current = 0;
        questionStartedAt.current = performance.now();
      }
      dispatch({ type: "advance", nextStepType: nextStep?.type ?? null });
    },
    [sequence],
  );

  const start = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    dispatch({ type: "start" });
  }, [clearAdvanceTimeout]);

  const continueScene = useCallback(() => {
    if (state.phase !== "scene") return;
    prepareNextStep(state.stepIndex + 1);
  }, [prepareNextStep, state.phase, state.stepIndex]);

  const submitAnswer = useCallback(
    (answer: AnswerValue | null, timedOut = false) => {
      if (answerLock.current || state.phase !== "playing" || currentStep?.type !== "question") {
        return;
      }
      answerLock.current = true;
      const rawTime = timedOut
        ? currentStep.question.timeLimit
        : (performance.now() - questionStartedAt.current) / 1000;
      const result = evaluateAnswer({
        question: currentStep.question,
        answer,
        timeUsed: rawTime,
        timedOut,
        incorrectAttempts: incorrectAttemptsRef.current,
        matchingIncorrectAttempts: incorrectAttemptsRef.current,
      });

      dispatch({
        type: "answer",
        result,
        timedOut,
        unlockEntryIds: currentStep.unlockEntryIds,
      });
      advanceTimeout.current = setTimeout(
        () => prepareNextStep(state.stepIndex + 1),
        TRANSITION_DURATION,
      );
    },
    [currentStep, prepareNextStep, state.phase, state.stepIndex],
  );

  const replay = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    dispatch({ type: "replay" });
  }, [clearAdvanceTimeout]);

  const handleTimeUp = useCallback(() => {
    if (currentStep?.type !== "question") return;
    submitAnswer(
      getTimedOutAnswer(currentStep.question, {
        draftAnswer: draftAnswerRef.current,
        submittedCodes: [],
      }),
      true,
    );
  }, [currentStep, submitAnswer]);

  const handleAnswerProgress = useCallback((answer: AnswerValue) => {
    draftAnswerRef.current = answer;
  }, []);

  const handleIncorrectAttempt = useCallback(() => {
    incorrectAttemptsRef.current += 1;
  }, []);

  const handleTimedResponseStart = useCallback(() => {
    if (
      currentStep?.type === "question" &&
      (currentStep.question.type === "flash-memory" ||
        currentStep.question.type === "simon-sequence" ||
        currentStep.question.type === "mini-wordle" ||
        currentStep.question.type === "progressive-image") &&
      !answerLock.current
    ) {
      questionStartedAt.current = performance.now();
    }
  }, [currentStep]);

  const unlockedEntries = useMemo(
    () => challenge.notebookEntries.filter((entry) => state.unlockedEntryIds.includes(entry.id)),
    [challenge.notebookEntries, state.unlockedEntryIds],
  );
  const questionSteps = useMemo(
    () => sequence.filter((step) => step.type === "question"),
    [sequence],
  );
  const questionNumber =
    currentStep?.type === "question"
      ? sequence.slice(0, state.stepIndex + 1).filter((step) => step.type === "question").length
      : 0;
  const lastResult = state.results.at(-1);
  const reactionStep =
    state.phase === "scene"
      ? sequence[state.stepIndex - 1]
      : state.phase === "prototype-results"
        ? currentStep
        : undefined;
  const reactionBlocks = getNarrativeReaction(reactionStep, lastResult, state.lastTimedOut);

  return {
    ...state,
    currentStep,
    questionNumber,
    totalQuestions: questionSteps.length,
    unlockedEntries,
    reactionBlocks,
    score: calculateTotalScore(state.results.map((result) => result.points)),
    start,
    continueScene,
    replay,
    submitAnswer,
    handleTimeUp,
    handleAnswerProgress,
    handleIncorrectAttempt,
    handleTimedResponseStart,
    openNotebook: () => dispatch({ type: "open-notebook" }),
    closeNotebook: () => dispatch({ type: "close-notebook" }),
  };
}
