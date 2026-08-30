"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  calculateTotalScore,
  evaluateAnswer,
  getTimedOutAnswer,
  isAnswerCorrect,
} from "@/lib/scoring";
import {
  getSurvivalLivesAfterResult,
  getSurvivalReachedQuestionCount,
  isSurvivalMistake,
  shouldEliminateAfterIncorrectAttempt,
} from "@/features/game/survivalRules";
import type { AnswerResult, AnswerValue, GamePhase, SurvivalChallenge } from "@/types/game";

const TRANSITION_DURATION = 650;

type SessionState = {
  phase: GamePhase;
  questionIndex: number;
  results: AnswerResult[];
  locked: boolean;
  lastTimedOut: boolean;
  codeAttempts: string[];
  livesRemaining: number;
  pendingLifePenalty: boolean;
  mistakes: number;
  eliminated: boolean;
  survived: boolean;
};

type SessionAction =
  | { type: "start"; lives: number }
  | {
      type: "answer";
      result: AnswerResult;
      timedOut: boolean;
      livesRemaining: number;
      mistakes: number;
      eliminated: boolean;
      survived: boolean;
    }
  | { type: "advance" }
  | { type: "finish" }
  | { type: "code-attempts"; attempts: string[] }
  | { type: "preview-life-penalty" }
  | { type: "show-review" }
  | { type: "show-results" }
  | { type: "replay"; lives: number };

function getInitialState(lives: number): SessionState {
  return {
    phase: "intro",
    questionIndex: 0,
    results: [],
    locked: false,
    lastTimedOut: false,
    codeAttempts: [],
    livesRemaining: lives,
    pendingLifePenalty: false,
    mistakes: 0,
    eliminated: false,
    survived: false,
  };
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "start":
      return { ...getInitialState(action.lives), phase: "playing" };
    case "answer":
      return {
        ...state,
        phase: "transition",
        locked: true,
        lastTimedOut: action.timedOut,
        results: [...state.results, action.result],
        livesRemaining: action.livesRemaining,
        pendingLifePenalty: false,
        mistakes: action.mistakes,
        eliminated: action.eliminated,
        survived: action.survived,
      };
    case "advance":
      return {
        ...state,
        phase: "playing",
        questionIndex: state.questionIndex + 1,
        locked: false,
        codeAttempts: [],
        pendingLifePenalty: false,
      };
    case "finish":
      return { ...state, phase: "results" };
    case "code-attempts":
      return { ...state, codeAttempts: action.attempts };
    case "preview-life-penalty":
      return { ...state, pendingLifePenalty: true };
    case "show-review":
      return { ...state, phase: "review" };
    case "show-results":
      return { ...state, phase: "results" };
    case "replay":
      return getInitialState(action.lives);
  }
}

export function useSurvivalSession(challenge: SurvivalChallenge) {
  const [state, dispatch] = useReducer(reducer, challenge.lives, getInitialState);
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

  const resetQuestionRefs = useCallback(() => {
    answerLock.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
  }, []);

  const start = useCallback(() => {
    clearAdvanceTimeout();
    resetQuestionRefs();
    questionStartedAt.current = performance.now();
    dispatch({ type: "start", lives: challenge.lives });
  }, [challenge.lives, clearAdvanceTimeout, resetQuestionRefs]);

  const replay = useCallback(() => {
    clearAdvanceTimeout();
    resetQuestionRefs();
    dispatch({ type: "replay", lives: challenge.lives });
  }, [challenge.lives, clearAdvanceTimeout, resetQuestionRefs]);

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
      const livesRemaining = getSurvivalLivesAfterResult(state.livesRemaining, result);
      const mistakes = state.mistakes + (isSurvivalMistake(result) ? 1 : 0);
      const lastQuestion = state.questionIndex === challenge.questions.length - 1;
      const eliminated = livesRemaining === 0;
      const survived = lastQuestion && !eliminated;

      dispatch({
        type: "answer",
        result,
        timedOut,
        livesRemaining,
        mistakes,
        eliminated,
        survived,
      });

      advanceTimeout.current = setTimeout(() => {
        if (eliminated || lastQuestion) {
          dispatch({ type: "finish" });
          return;
        }
        resetQuestionRefs();
        questionStartedAt.current = performance.now();
        dispatch({ type: "advance" });
      }, TRANSITION_DURATION);
    },
    [
      challenge.questions.length,
      question,
      resetQuestionRefs,
      state.livesRemaining,
      state.mistakes,
      state.questionIndex,
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
    if (answerLock.current || (question?.type !== "matching" && question?.type !== "queens"))
      return;
    if (incorrectAttemptsRef.current === 0) {
      dispatch({ type: "preview-life-penalty" });
    }
    incorrectAttemptsRef.current += 1;
    if (shouldEliminateAfterIncorrectAttempt(question?.type, state.livesRemaining)) {
      submitAnswer(draftAnswerRef.current ?? {}, false);
    }
  }, [question, state.livesRemaining, submitAnswer]);

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
  const displayedLivesRemaining =
    state.phase === "playing" && state.pendingLifePenalty
      ? Math.max(0, state.livesRemaining - 1)
      : state.livesRemaining;

  return {
    ...state,
    question,
    livesRemaining: displayedLivesRemaining,
    score,
    reachedQuestionCount: getSurvivalReachedQuestionCount(state.results.length),
    start,
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
