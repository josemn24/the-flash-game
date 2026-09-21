"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advancePyramidToNextBriefing,
  armPyramidLevel,
  beginPyramidLevel,
  completePyramidAttempt,
  createPyramidAttempt,
  getPyramidAttemptStorageKey,
  isPyramidLevelPassed,
  normalizePyramidResult,
  parsePyramidAttempt,
  type PyramidAttemptRecord,
} from "@/features/pyramid/pyramidAttempt";
import { evaluateAnswer, getTimedOutAnswer, isAnswerCorrect } from "@/lib/scoring";
import type { AnswerValue, PyramidChallenge } from "@/types/game";

const DEFAULT_TRANSITION_DURATION = 900;
const DEFAULT_FEEDBACK_DURATIONS = {
  correct: DEFAULT_TRANSITION_DURATION,
  incorrect: 1500,
  unanswered: 1500,
} as const;
const STORAGE_PROBE_KEY = "the-flash:pyramid-storage-probe";

export type PyramidSessionOptions = {
  persistence?: "local" | "memory";
  storageNamespace?: string;
  feedbackDuration?: Partial<{
    correct: number;
    incorrect: number;
    unanswered: number;
  }>;
};

export type PyramidSessionPhase =
  "loading" | "intro" | "briefing" | "playing" | "transition" | "results" | "review";

function storageIsAvailable() {
  try {
    window.localStorage.setItem(STORAGE_PROBE_KEY, "1");
    window.localStorage.removeItem(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function usePyramidSession(
  challenge: PyramidChallenge,
  options: PyramidSessionOptions = {},
) {
  const persistence = options.persistence ?? "local";
  const storageKey = getPyramidAttemptStorageKey(challenge, options.storageNamespace);
  const feedbackDurations = { ...DEFAULT_FEEDBACK_DURATIONS, ...options.feedbackDuration };
  const [phase, setPhase] = useState<PyramidSessionPhase>("loading");
  const [record, setRecord] = useState<PyramidAttemptRecord | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(persistence === "memory");
  const recordRef = useRef<PyramidAttemptRecord | null>(null);
  const answerLock = useRef(false);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: PyramidAttemptRecord) => {
      recordRef.current = next;
      setRecord(next);
      if (persistence !== "local") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        setStorageAvailable(false);
      }
    },
    [persistence, storageKey],
  );

  const advanceFromTransition = useCallback(
    (source: PyramidAttemptRecord) => {
      const next = advancePyramidToNextBriefing(source, challenge.levels.length);
      if (next === source) return;
      answerLock.current = false;
      persist(next);
      setPhase("briefing");
    },
    [challenge.levels.length, persist],
  );

  const submitAnswer = useCallback(
    (answer: AnswerValue | null, timedOut = false, submittedCodes?: string[]) => {
      const current = recordRef.current;
      if (answerLock.current || !current || current.status === "completed") return;
      const level = challenge.levels[current.currentLevelIndex];
      if (!level || current.levelStartedAt === null) return;
      answerLock.current = true;

      const now = Date.now();
      const timeUsed = timedOut
        ? level.question.timeLimit
        : Math.min(level.question.timeLimit, Math.max(0, (now - current.levelStartedAt) / 1000));
      const result = normalizePyramidResult(
        evaluateAnswer({
          question: level.question,
          answer,
          timeUsed,
          timedOut,
          submittedCodes: submittedCodes ?? current.submittedCodes,
          incorrectAttempts: current.incorrectAttempts,
          matchingIncorrectAttempts: current.incorrectAttempts,
          progressiveCluesRevealed: current.progressiveCluesRevealed,
        }),
      );
      const passed = isPyramidLevelPassed(result);
      const lastLevel = current.currentLevelIndex === challenge.levels.length - 1;

      if (!passed || lastLevel) {
        persist(completePyramidAttempt(current, result, passed ? "summit" : "failed", now));
        setPhase("transition");
        const duration =
          result.status === "correct"
            ? feedbackDurations.correct
            : result.status === "unanswered"
              ? feedbackDurations.unanswered
              : feedbackDurations.incorrect;
        transitionTimeout.current = setTimeout(() => setPhase("results"), duration);
        return;
      }

      const next: PyramidAttemptRecord = {
        ...current,
        phase: "transition",
        deadlineAt: null,
        results: [...current.results, result],
        draftAnswer: null,
        submittedCodes: [],
        incorrectAttempts: 0,
        progressiveCluesRevealed: 1,
      };
      persist(next);
      setPhase("transition");
      transitionTimeout.current = setTimeout(
        () => advanceFromTransition(next),
        feedbackDurations.correct,
      );
    },
    [
      advanceFromTransition,
      challenge.levels,
      feedbackDurations.correct,
      feedbackDurations.incorrect,
      feedbackDurations.unanswered,
      persist,
    ],
  );

  const applyLoadedRecord = useCallback(
    (loaded: PyramidAttemptRecord) => {
      recordRef.current = loaded;
      setRecord(loaded);
      answerLock.current = false;
      if (loaded.status === "completed") {
        setPhase("results");
        return;
      }
      if (
        loaded.phase === "playing" &&
        loaded.deadlineAt !== null &&
        loaded.deadlineAt <= Date.now()
      ) {
        const level = challenge.levels[loaded.currentLevelIndex];
        if (level) {
          submitAnswer(
            getTimedOutAnswer(level.question, {
              draftAnswer: loaded.draftAnswer,
              submittedCodes: loaded.submittedCodes,
            }),
            true,
            loaded.submittedCodes,
          );
          return;
        }
      }
      if (loaded.phase === "transition") {
        advanceFromTransition(loaded);
        return;
      }
      if (loaded.phase === "briefing") {
        setPhase("briefing");
        return;
      }
      setPhase("playing");
    },
    [advanceFromTransition, challenge.levels, submitAnswer],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (persistence !== "local") {
        setPhase("intro");
        return;
      }
      const available = storageIsAvailable();
      setStorageAvailable(available);
      if (!available) {
        setPhase("intro");
        return;
      }

      const serialized = window.localStorage.getItem(storageKey);
      if (serialized) {
        const loaded = parsePyramidAttempt(serialized, challenge);
        if (loaded) {
          applyLoadedRecord(loaded);
          return;
        }
        window.localStorage.removeItem(storageKey);
      }
      setPhase("intro");
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoadedRecord, challenge, persistence, storageKey]);

  useEffect(() => {
    if (persistence !== "local") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      const loaded = parsePyramidAttempt(event.newValue, challenge);
      if (loaded) applyLoadedRecord(loaded);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyLoadedRecord, challenge, persistence, storageKey]);

  useEffect(
    () => () => {
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    },
    [],
  );

  const currentLevel = record ? challenge.levels[record.currentLevelIndex] : undefined;

  const start = useCallback(() => {
    if (persistence === "local" && storageAvailable) {
      const existing = window.localStorage.getItem(storageKey);
      if (existing) {
        const loaded = parsePyramidAttempt(existing, challenge);
        if (loaded?.status === "in-progress") {
          applyLoadedRecord(loaded);
          return;
        }
      }
    }
    const next = createPyramidAttempt(challenge, Date.now());
    persist(next);
    setPhase("briefing");
  }, [applyLoadedRecord, challenge, persistence, persist, storageAvailable, storageKey]);

  const beginLevel = useCallback(() => {
    const current = recordRef.current;
    if (!current || current.status === "completed") return;
    const next = beginPyramidLevel(current);
    if (next === current) return;
    answerLock.current = false;
    persist(next);
    setPhase("playing");
  }, [persist]);

  const armCurrentLevel = useCallback(() => {
    const current = recordRef.current;
    if (!current || current.status === "completed") return;
    const level = challenge.levels[current.currentLevelIndex];
    if (!level) return;
    const next = armPyramidLevel(current, level.question, null, Date.now());
    if (next !== current) persist(next);
  }, [challenge, persist]);

  const restart = useCallback(() => {
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    answerLock.current = false;
    const next = createPyramidAttempt(challenge, Date.now());
    persist(next);
    setPhase("briefing");
  }, [challenge, persist]);

  const handleTimeUp = useCallback(() => {
    const current = recordRef.current;
    if (!current || current.status === "completed") return;
    const level = challenge.levels[current.currentLevelIndex];
    if (!level) return;
    submitAnswer(
      getTimedOutAnswer(level.question, {
        draftAnswer: current.draftAnswer,
        submittedCodes: current.submittedCodes,
      }),
      true,
      current.submittedCodes,
    );
  }, [challenge.levels, submitAnswer]);

  useEffect(() => {
    if (
      phase === "playing" &&
      record?.deadlineAt !== null &&
      typeof record?.deadlineAt === "number" &&
      record.deadlineAt <= Date.now()
    ) {
      handleTimeUp();
    }
  }, [handleTimeUp, phase, record?.deadlineAt]);

  const handleAnswerProgress = useCallback(
    (answer: AnswerValue) => {
      const current = recordRef.current;
      if (!current || current.status === "completed") return;
      persist({ ...current, draftAnswer: answer });
    },
    [persist],
  );

  const handleIncorrectAttempt = useCallback(() => {
    const current = recordRef.current;
    if (!current || current.status === "completed") return;
    persist({ ...current, incorrectAttempts: current.incorrectAttempts + 1 });
  }, [persist]);

  const handleProgressiveClueReveal = useCallback(
    (revealedClues: number) => {
      const current = recordRef.current;
      if (!current || current.status === "completed") return;
      persist({
        ...current,
        progressiveCluesRevealed: Math.max(1, Math.round(revealedClues)),
      });
    },
    [persist],
  );

  const handleCodeAttempt = useCallback(
    (code: string) => {
      const current = recordRef.current;
      const level = current ? challenge.levels[current.currentLevelIndex] : undefined;
      if (!current || !level || level.question.type !== "logic-code") return false;
      const submittedCodes = [...current.submittedCodes, code];
      const correct = isAnswerCorrect(level.question, code);
      persist({
        ...current,
        submittedCodes,
        incorrectAttempts: current.incorrectAttempts + (correct ? 0 : 1),
        draftAnswer: correct ? code : null,
      });
      if (correct) submitAnswer(code, false, submittedCodes);
      return correct;
    },
    [challenge.levels, persist, submitAnswer],
  );

  const latestResult = record?.results.at(-1);
  const summary = record?.summary;

  return {
    phase,
    record,
    currentLevel,
    latestResult,
    summary,
    storageAvailable,
    locked: phase !== "playing",
    codeAttempts: record?.submittedCodes ?? [],
    initialAnswer: record?.draftAnswer ?? null,
    deadlineAt: record?.deadlineAt ?? null,
    start,
    beginLevel,
    restart,
    armCurrentLevel,
    submitAnswer,
    handleTimeUp,
    handleAnswerProgress,
    handleIncorrectAttempt,
    handleProgressiveClueReveal,
    handleCodeAttempt,
    showReview: () => setPhase("review"),
    showResults: () => setPhase("results"),
    score: summary?.score ?? 0,
    levelsCleared:
      summary?.levelsCleared ?? record?.results.filter(isPyramidLevelPassed).length ?? 0,
  };
}
