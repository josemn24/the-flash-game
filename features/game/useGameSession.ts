"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { calculateTotalScore, evaluateAnswer, isAnswerCorrect } from "@/lib/scoring";
import type { AnswerResult, AnswerValue, GamePhase, Stage } from "@/types/game";

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
  | { type: "start" }
  | { type: "answer"; result: AnswerResult; timedOut: boolean }
  | { type: "advance" }
  | { type: "finish" }
  | { type: "code-attempts"; attempts: string[] }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "replay" };

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

export function useGameSession(stage: Stage) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const question = stage.questions[state.questionIndex];
  const questionStartedAt = useRef(0);
  const answerLock = useRef(false);
  const codeAttemptsRef = useRef<string[]>([]);
  const draftAnswerRef = useRef<AnswerValue | null>(null);
  const matchingIncorrectAttemptsRef = useRef(0);
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
    matchingIncorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    questionStartedAt.current = performance.now();
    dispatch({ type: "start" });
  }, [clearAdvanceTimeout]);

  const replay = useCallback(() => {
    clearAdvanceTimeout();
    answerLock.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    matchingIncorrectAttemptsRef.current = 0;
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
        submittedCodes,
        matchingIncorrectAttempts:
          question.type === "matching" ? matchingIncorrectAttemptsRef.current : undefined,
        progressiveCluesRevealed:
          question.type === "progressive-clues" ? progressiveCluesRevealedRef.current : undefined,
      });

      dispatch({ type: "answer", result, timedOut });
      const lastQuestion = state.questionIndex === stage.questions.length - 1;
      advanceTimeout.current = setTimeout(() => {
        if (lastQuestion) {
          dispatch({ type: "finish" });
          return;
        }
        answerLock.current = false;
        codeAttemptsRef.current = [];
        draftAnswerRef.current = null;
        matchingIncorrectAttemptsRef.current = 0;
        progressiveCluesRevealedRef.current = 1;
        questionStartedAt.current = performance.now();
        dispatch({ type: "advance" });
      }, TRANSITION_DURATION);
    },
    [question, stage.questions.length, state.questionIndex],
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
    if (question?.type === "logic-code") {
      const attempts = codeAttemptsRef.current;
      submitAnswer(attempts.at(-1) ?? null, true, attempts);
      return;
    }
    if (question?.type === "matching") {
      submitAnswer(draftAnswerRef.current, true);
      return;
    }
    if (
      question?.type === "flash-memory" ||
      question?.type === "mini-sudoku" ||
      question?.type === "mini-nonogram" ||
      question?.type === "error-reconstruction"
    ) {
      submitAnswer(draftAnswerRef.current, true);
      return;
    }
    submitAnswer(null, true);
  }, [question, submitAnswer]);

  const handleAnswerProgress = useCallback((answer: AnswerValue) => {
    draftAnswerRef.current = answer;
  }, []);

  const handleMatchingIncorrectAttempt = useCallback(() => {
    matchingIncorrectAttemptsRef.current += 1;
  }, []);

  const handleProgressiveClueReveal = useCallback((revealedClues: number) => {
    progressiveCluesRevealedRef.current = revealedClues;
  }, []);

  const handleTimedResponseStart = useCallback(() => {
    if (
      (question?.type === "flash-memory" || question?.type === "simon-sequence") &&
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
    replay,
    submitAnswer,
    handleCodeAttempt,
    handleTimeUp,
    handleAnswerProgress,
    handleMatchingIncorrectAttempt,
    handleProgressiveClueReveal,
    handleTimedResponseStart,
    showReview: () => dispatch({ type: "show-review" }),
    showResults: () => dispatch({ type: "show-results" }),
  };
}
