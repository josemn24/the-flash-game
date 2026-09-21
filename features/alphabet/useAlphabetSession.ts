"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  alphabetReducer,
  calculateAlphabetScore,
  createAlphabetInitialState,
  isAlphabetAnswerCorrect,
} from "@/features/alphabet/alphabetGame";
import type { AlphabetChallenge, ShortTextQuestion } from "@/types/game";

const FEEDBACK_DURATION = 500;

export function useAlphabetSession(challenge: AlphabetChallenge) {
  const [state, dispatch] = useReducer(alphabetReducer, challenge, createAlphabetInitialState);
  const startedAt = useRef(0);
  const actionLocked = useRef(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = null;
    }
  }, []);

  useEffect(() => clearFeedbackTimeout, [clearFeedbackTimeout]);

  const beginCountdown = useCallback(() => {
    clearFeedbackTimeout();
    actionLocked.current = false;
    dispatch({ type: "begin-countdown" });
  }, [clearFeedbackTimeout]);

  const start = useCallback(() => {
    startedAt.current = performance.now();
    actionLocked.current = false;
    dispatch({ type: "start" });
  }, []);

  const getElapsedTime = useCallback(
    () =>
      Math.min(challenge.timeLimit, Math.max(0, (performance.now() - startedAt.current) / 1000)),
    [challenge.timeLimit],
  );

  const submitAnswer = useCallback(
    (answer: string) => {
      if (actionLocked.current || state.phase !== "playing") return;
      const entry = challenge.entries[state.currentIndex];
      if (!entry || entry.question.type !== "short-text") return;

      const value = answer.trim();
      if (!value) return;
      actionLocked.current = true;
      const correct = isAlphabetAnswerCorrect(entry.question as ShortTextQuestion, value);
      dispatch({
        type: "submit",
        answer: value,
        correct,
        elapsedTime: getElapsedTime(),
      });

      feedbackTimeout.current = setTimeout(() => {
        actionLocked.current = false;
        dispatch({ type: "advance" });
      }, FEEDBACK_DURATION);
    },
    [challenge.entries, getElapsedTime, state.currentIndex, state.phase],
  );

  const pass = useCallback(() => {
    if (actionLocked.current || state.phase !== "playing") return;
    dispatch({ type: "pass" });
  }, [state.phase]);

  const finish = useCallback(() => {
    if (state.phase !== "playing" && state.phase !== "feedback") return;
    clearFeedbackTimeout();
    actionLocked.current = true;
    dispatch({ type: "finish", elapsedTime: getElapsedTime() });
  }, [clearFeedbackTimeout, getElapsedTime, state.phase]);

  const replay = useCallback(() => {
    clearFeedbackTimeout();
    actionLocked.current = false;
    startedAt.current = 0;
    dispatch({ type: "replay" });
  }, [clearFeedbackTimeout]);

  const activeEntry = challenge.entries[state.currentIndex];
  const correctAnswers = state.letters.filter((letter) => letter.status === "correct").length;
  const incorrectAnswers = state.letters.filter((letter) => letter.status === "incorrect").length;
  const unanswered = state.letters.filter((letter) => letter.status === "unanswered").length;
  const score = calculateAlphabetScore(correctAnswers, state.letters.length);

  return useMemo(
    () => ({
      ...state,
      activeEntry,
      correctAnswers,
      incorrectAnswers,
      unanswered,
      playedCount: state.playedCount,
      score,
      beginCountdown,
      start,
      submitAnswer,
      pass,
      finish,
      replay,
      showReview: () => dispatch({ type: "show-review" }),
      showResults: () => dispatch({ type: "show-results" }),
    }),
    [
      activeEntry,
      beginCountdown,
      correctAnswers,
      finish,
      incorrectAnswers,
      pass,
      replay,
      score,
      start,
      state,
      submitAnswer,
      unanswered,
    ],
  );
}
