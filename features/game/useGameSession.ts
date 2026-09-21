"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  calculateTotalScore,
  evaluateAnswer,
  getTimedOutAnswer,
  isAnswerCorrect,
} from "@/lib/scoring";
import type {
  AnswerResult,
  AnswerStatus,
  AnswerValue,
  FlashChallenge,
  GamePhase,
} from "@/types/game";

const TRANSITION_DURATION = 650;

type SessionState = {
  phase: GamePhase;
  questionIndex: number;
  results: AnswerResult[];
  locked: boolean;
  lastTimedOut: boolean;
  codeAttempts: string[];
};

type SessionAction =
  | { type: "begin-countdown" }
  | { type: "start" }
  | { type: "answer"; result: AnswerResult; timedOut: boolean }
  | { type: "advance" }
  | { type: "finish" }
  | { type: "code-attempts"; attempts: string[] }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "replay" };

type GameSessionOptions = {
  transitionDuration?: Partial<Record<AnswerStatus, number>>;
};

const initialState: SessionState = {
  phase: "intro",
  questionIndex: 0,
  results: [],
  locked: false,
  lastTimedOut: false,
  codeAttempts: [],
};

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "begin-countdown":
      return { ...state, phase: "countdown" };
    case "start":
      return { ...initialState, phase: "playing" };
    case "answer":
      return {
        ...state,
        phase: "transition",
        locked: true,
        lastTimedOut: action.timedOut,
        results: [...state.results, action.result],
      };
    case "advance":
      return {
        ...state,
        phase: "playing",
        questionIndex: state.questionIndex + 1,
        locked: false,
        codeAttempts: [],
      };
    case "finish":
      return { ...state, phase: "results" };
    case "code-attempts":
      return { ...state, codeAttempts: action.attempts };
    case "show-review":
      return { ...state, phase: "review" };
    case "show-results":
      return { ...state, phase: "results" };
    case "replay":
      return initialState;
  }
}

export function useGameSession(challenge: FlashChallenge, options: GameSessionOptions = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const correctTransitionDuration = options.transitionDuration?.correct ?? TRANSITION_DURATION;
  const partialTransitionDuration = options.transitionDuration?.partial ?? TRANSITION_DURATION;
  const incorrectTransitionDuration = options.transitionDuration?.incorrect ?? TRANSITION_DURATION;
  const unansweredTransitionDuration =
    options.transitionDuration?.unanswered ?? TRANSITION_DURATION;
  const question = challenge.questions[state.questionIndex];
  const questionStartedAt = useRef(0);
  const answerLock = useRef(false);
  const codeAttemptsRef = useRef<string[]>([]);
  const draftAnswerRef = useRef<AnswerValue | null>(null);
  const incorrectAttemptsRef = useRef(0);
  const progressiveCluesRevealedRef = useRef(1);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeout.current) {
      clearTimeout(advanceTimeout.current);
      advanceTimeout.current = null;
    }
  }, []);

  useEffect(() => clearAdvanceTimeout, [clearAdvanceTimeout]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase, state.questionIndex]);

  const start = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    questionStartedAt.current = performance.now();
    dispatch({ type: "start" });
  }, [clearAdvanceTimeout]);

  const beginCountdown = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    dispatch({ type: "begin-countdown" });
  }, [clearAdvanceTimeout]);

  const replay = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    dispatch({ type: "replay" });
  }, [clearAdvanceTimeout]);

  const submitAnswer = useCallback(
    (answer: AnswerValue | null, timedOut = false, submittedCodes?: string[]) => {
      if (answerLock.current || !question) return;
      answerLock.current = true;

      const rawTime = timedOut
        ? question.timeLimit
        : (performance.now() - questionStartedAt.current) / 1000;
      const result = evaluateAnswer({
        question,
        answer,
        timeUsed: rawTime,
        timedOut,
        submittedCodes: submittedCodes ?? codeAttemptsRef.current,
        incorrectAttempts: incorrectAttemptsRef.current,
        matchingIncorrectAttempts: incorrectAttemptsRef.current,
        progressiveCluesRevealed: progressiveCluesRevealedRef.current,
      });

      dispatch({ type: "answer", result, timedOut });
      const lastQuestion = state.questionIndex === challenge.questions.length - 1;
      const transitionDuration =
        result.status === "correct"
          ? correctTransitionDuration
          : result.status === "partial"
            ? partialTransitionDuration
            : result.status === "unanswered"
              ? unansweredTransitionDuration
              : incorrectTransitionDuration;

      advanceTimeout.current = setTimeout(() => {
        if (lastQuestion) {
          dispatch({ type: "finish" });
          return;
        }
        answerLock.current = false;
        codeAttemptsRef.current = [];
        draftAnswerRef.current = null;
        incorrectAttemptsRef.current = 0;
        progressiveCluesRevealedRef.current = 1;
        questionStartedAt.current = performance.now();
        dispatch({ type: "advance" });
      }, transitionDuration);
    },
    [
      challenge.questions.length,
      correctTransitionDuration,
      incorrectTransitionDuration,
      partialTransitionDuration,
      question,
      state.questionIndex,
      unansweredTransitionDuration,
    ],
  );

  const handleCodeAttempt = useCallback(
    (code: string) => {
      if (answerLock.current || question?.type !== "logic-code") return false;
      const attempts = [...codeAttemptsRef.current, code];
      codeAttemptsRef.current = attempts;
      dispatch({ type: "code-attempts", attempts });
      const correct = isAnswerCorrect(question, code);
      if (correct) submitAnswer(code, false, attempts);
      return correct;
    },
    [question, submitAnswer],
  );

  const handleTimeUp = useCallback(() => {
    if (!question) return;
    const submittedCodes = codeAttemptsRef.current;
    submitAnswer(
      getTimedOutAnswer(question, {
        draftAnswer: draftAnswerRef.current,
        submittedCodes,
      }),
      true,
      submittedCodes,
    );
  }, [question, submitAnswer]);

  const handleAnswerProgress = useCallback((answer: AnswerValue) => {
    draftAnswerRef.current = answer;
  }, []);

  const handleIncorrectAttempt = useCallback(() => {
    incorrectAttemptsRef.current += 1;
  }, []);

  const handleProgressiveClueReveal = useCallback((revealedClues: number) => {
    progressiveCluesRevealedRef.current = revealedClues;
  }, []);

  const handleTimedResponseStart = useCallback(() => {
    if (
      (question?.type === "flash-memory" ||
        question?.type === "simon-sequence" ||
        question?.type === "mini-wordle" ||
        question?.type === "progressive-image") &&
      !answerLock.current
    ) {
      questionStartedAt.current = performance.now();
    }
  }, [question]);

  const score = useMemo(
    () => calculateTotalScore(state.results.map((result) => result.points)),
    [state.results],
  );

  return {
    ...state,
    question,
    score,
    start,
    beginCountdown,
    replay,
    submitAnswer,
    handleCodeAttempt,
    handleTimeUp,
    handleAnswerProgress,
    handleIncorrectAttempt,
    handleProgressiveClueReveal,
    handleTimedResponseStart,
    showReview: () => dispatch({ type: "show-review" }),
    showResults: () => dispatch({ type: "show-results" }),
  };
}
