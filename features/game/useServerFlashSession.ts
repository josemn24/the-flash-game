"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerResult, AnswerValue, FlashChallenge, GameRoomContext } from "@/types/game";
import type {
  ServerFlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import {
  challengeWithReview,
  displayChallenge,
  questionFromPayload,
  terminalReviewFromResponse,
} from "@/features/game/serverFlashQuestionAdapter";

export type ServerFlashPhase =
  "intro" | "recovering" | "countdown" | "playing" | "transition" | "results" | "review";

type AttemptState = { id: string; lockVersion: number };
type SubmissionState = "idle" | "submitting" | "error";
type PendingAnswerSubmission = {
  kind: "answer";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  answer: AnswerValue | null;
  idempotencyKey: string;
};
type PendingMiniWordleSubmission = {
  kind: "mini-wordle";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  guess: string;
  idempotencyKey: string;
};
type PendingLogicCodeSubmission = {
  kind: "logic-code";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  code: string;
  idempotencyKey: string;
};
type PendingProgressiveClueReveal = {
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  idempotencyKey: string;
};
type PendingMatchingPair = {
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  leftItemId: string;
  rightItemId: string;
  idempotencyKey: string;
};
type PendingWordSearchSelection = {
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  startCell: number;
  endCell: number;
  idempotencyKey: string;
};
type PendingQueensPlacement = {
  kind: "queens";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  cell: number;
  action: "place" | "remove";
  idempotencyKey: string;
};
type PendingSubmission =
  PendingAnswerSubmission | PendingMiniWordleSubmission | PendingLogicCodeSubmission;

const SUBMISSION_STATUS_DELAY_MS = 250;

class CompetitiveCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function serverTimestamp(value: unknown): number {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) throw new Error("invalid_server_timestamp");
  return timestamp;
}

async function postJson(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = value.error;
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "competitive_command_failed";
    throw new CompetitiveCommandError(code);
  }
  return value;
}

function initialResults(roomContext: GameRoomContext): AnswerResult[] {
  return (roomContext.result?.attempt?.answers ?? []).map((answer) => ({
    questionId: answer.questionId,
    answer: answer.answer,
    status: answer.status,
    isCorrect: answer.isCorrect,
    points: answer.points ?? 0,
    timeUsed: answer.timeUsed ?? 0,
    ...(answer.details ? { details: answer.details } : {}),
  }));
}

export function useServerFlashSession({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerFlashChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<ServerFlashPhase>(
    roomContext.result
      ? "results"
      : roomContext.attemptStatus === "inProgress"
        ? "recovering"
        : "intro",
  );
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState<ServerFlashQuestion | null>(null);
  const [questionPresentedAt, setQuestionPresentedAt] = useState<number | null>(null);
  const [questionDeadlineAt, setQuestionDeadlineAt] = useState<number | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(() => initialResults(roomContext));
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [reviewChallenge, setReviewChallenge] = useState<FlashChallenge | null>(() =>
    terminalReview?.length ? challengeWithReview(challenge, terminalReview) : null,
  );
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionStatusVisible, setSubmissionStatusVisible] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const [revealState, setRevealState] = useState<SubmissionState>("idle");
  const [revealStatusVisible, setRevealStatusVisible] = useState(false);
  const [revealError, setRevealError] = useState<string>();
  const [matchingState, setMatchingState] = useState<SubmissionState>("idle");
  const [matchingStatusVisible, setMatchingStatusVisible] = useState(false);
  const [matchingError, setMatchingError] = useState<string>();
  const [queensState, setQueensState] = useState<SubmissionState>("idle");
  const [queensStatusVisible, setQueensStatusVisible] = useState(false);
  const [queensError, setQueensError] = useState<string>();
  const [wordSearchState, setWordSearchState] = useState<SubmissionState>("idle");
  const [wordSearchStatusVisible, setWordSearchStatusVisible] = useState(false);
  const [wordSearchError, setWordSearchError] = useState<string>();
  const [lastMatchingPair, setLastMatchingPair] = useState<
    { readonly leftId: string; readonly rightId: string; readonly correct: boolean } | undefined
  >();
  const [lastWordSearchSelection, setLastWordSearchSelection] = useState<
    { readonly startCell: number; readonly endCell: number; readonly correct: boolean } | undefined
  >();
  const [pendingAnswer, setPendingAnswer] = useState<AnswerValue | null>(null);
  const [startNotice, setStartNotice] = useState<string>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submissionStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const matchingStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queensStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordSearchStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSubmissionRef = useRef<PendingSubmission | null>(null);
  const pendingRevealRef = useRef<PendingProgressiveClueReveal | null>(null);
  const pendingMatchingPairRef = useRef<PendingMatchingPair | null>(null);
  const pendingQueensPlacementRef = useRef<PendingQueensPlacement | null>(null);
  const pendingWordSearchSelectionRef = useRef<PendingWordSearchSelection | null>(null);
  const recoveryStarted = useRef(false);
  const display = useMemo(() => displayChallenge(challenge), [challenge]);

  const clearSubmissionStatusTimer = () => {
    if (submissionStatusTimerRef.current) {
      clearTimeout(submissionStatusTimerRef.current);
      submissionStatusTimerRef.current = undefined;
    }
  };

  const startSubmissionStatus = () => {
    clearSubmissionStatusTimer();
    setSubmissionState("submitting");
    setSubmissionStatusVisible(false);
    setSubmissionError(undefined);
    submissionStatusTimerRef.current = setTimeout(() => {
      setSubmissionStatusVisible(true);
      submissionStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
  };

  const clearRevealStatusTimer = () => {
    if (revealStatusTimerRef.current) {
      clearTimeout(revealStatusTimerRef.current);
      revealStatusTimerRef.current = undefined;
    }
  };

  const startRevealStatus = () => {
    clearRevealStatusTimer();
    setRevealState("submitting");
    setRevealStatusVisible(false);
    setRevealError(undefined);
    revealStatusTimerRef.current = setTimeout(() => {
      setRevealStatusVisible(true);
      revealStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
  };

  const clearMatchingStatusTimer = () => {
    if (matchingStatusTimerRef.current) {
      clearTimeout(matchingStatusTimerRef.current);
      matchingStatusTimerRef.current = undefined;
    }
  };

  const startMatchingStatus = () => {
    clearMatchingStatusTimer();
    setMatchingState("submitting");
    setMatchingStatusVisible(false);
    setMatchingError(undefined);
    matchingStatusTimerRef.current = setTimeout(() => {
      setMatchingStatusVisible(true);
      matchingStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
  };

  const clearQueensStatusTimer = () => {
    if (queensStatusTimerRef.current) {
      clearTimeout(queensStatusTimerRef.current);
      queensStatusTimerRef.current = undefined;
    }
  };

  const startQueensStatus = () => {
    clearQueensStatusTimer();
    setQueensState("submitting");
    setQueensStatusVisible(false);
    setQueensError(undefined);
    queensStatusTimerRef.current = setTimeout(() => {
      setQueensStatusVisible(true);
      queensStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
  };

  const clearWordSearchStatusTimer = () => {
    if (wordSearchStatusTimerRef.current) {
      clearTimeout(wordSearchStatusTimerRef.current);
      wordSearchStatusTimerRef.current = undefined;
    }
  };

  const startWordSearchStatus = () => {
    clearWordSearchStatusTimer();
    setWordSearchState("submitting");
    setWordSearchStatusVisible(false);
    setWordSearchError(undefined);
    wordSearchStatusTimerRef.current = setTimeout(() => {
      setWordSearchStatusVisible(true);
      wordSearchStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearSubmissionStatusTimer();
      clearRevealStatusTimer();
      clearMatchingStatusTimer();
      clearQueensStatusTimer();
      clearWordSearchStatusTimer();
    },
    [],
  );

  const prepare = async (currentAttempt: AttemptState) => {
    const prepared = await postJson(`/api/competitive/attempts/${currentAttempt.id}/prepare`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: idempotencyKey("prepare"),
    });
    const nextLockVersion = Number(prepared.lockVersion);
    const itemId = String(prepared.challengeItemId);
    const nextIndex = challenge.slots.findIndex((item) => item.id === itemId);
    if (nextIndex < 0) throw new Error("competitive_question_not_found");
    const slot = challenge.slots[nextIndex]!;
    const presentedAt = serverTimestamp(prepared.presentedAt);
    const deadlineAt = serverTimestamp(prepared.deadlineAt);
    setAttempt({ id: currentAttempt.id, lockVersion: nextLockVersion });
    setQuestionIndex(nextIndex);
    setQuestion(
      questionFromPayload(
        itemId,
        prepared.publicPayload,
        slot.timeLimitMs,
        slot.points,
        slot.questionType,
        prepared.progress,
      ),
    );
    setQuestionPresentedAt(presentedAt);
    setQuestionDeadlineAt(deadlineAt);
    setRevealState("idle");
    setRevealStatusVisible(false);
    setRevealError(undefined);
    pendingRevealRef.current = null;
    setMatchingState("idle");
    setMatchingStatusVisible(false);
    setMatchingError(undefined);
    setLastMatchingPair(undefined);
    pendingMatchingPairRef.current = null;
    setQueensState("idle");
    setQueensStatusVisible(false);
    setQueensError(undefined);
    pendingQueensPlacementRef.current = null;
    setWordSearchState("idle");
    setWordSearchStatusVisible(false);
    setWordSearchError(undefined);
    setLastWordSearchSelection(undefined);
    pendingWordSearchSelectionRef.current = null;
    setLocked(Boolean(prepared.timedOut));
    setPhase("playing");
  };

  const recover = async () => {
    const started = await postJson("/api/competitive/attempts/start", {
      scheduledChallengeId: challenge.id,
      idempotencyKey: idempotencyKey("start"),
    });
    const currentAttempt: AttemptState = {
      id: String(started.attemptId),
      lockVersion: Number(started.lockVersion),
    };
    setAttempt(currentAttempt);
    const response = await postJson(`/api/competitive/attempts/${currentAttempt.id}/recover`, {
      lockVersion: currentAttempt.lockVersion,
    });
    const recoveredResults = Array.isArray(response.answers)
      ? response.answers.map((answer) => {
          const item = answer as Record<string, unknown>;
          return {
            questionId: String(item.challengeItemId),
            answer: item.answer as AnswerValue,
            status: String(item.status) as AnswerResult["status"],
            isCorrect: item.status === "correct" || item.status === "partial",
            points: Number(item.points),
            timeUsed: Number(item.timeUsedMs) / 1000,
          } satisfies AnswerResult;
        })
      : [];
    setResults(recoveredResults);
    setAttempt({ id: currentAttempt.id, lockVersion: Number(response.lockVersion) });
    if (response.phase === "results") {
      const rows = terminalReviewFromResponse(response.review);
      setScore(Number(response.score ?? 0));
      setReviewChallenge(rows.length ? challengeWithReview(challenge, rows) : null);
      setQuestionPresentedAt(null);
      setQuestionDeadlineAt(null);
      setPhase("results");
    } else if (response.phase === "countdown") {
      setPhase("countdown");
    } else if (response.resolved) {
      const resolved = response.resolved as Record<string, unknown>;
      const result =
        recoveredResults.find((item) => item.questionId === String(resolved.challengeItemId)) ??
        recoveredResults.at(-1);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        () => void prepare({ id: currentAttempt.id, lockVersion: Number(response.lockVersion) }),
        900,
      );
    } else {
      await prepare({ id: currentAttempt.id, lockVersion: Number(response.lockVersion) });
    }
  };

  const submitQueensPlacementToServer = async (submission: PendingQueensPlacement) => {
    startQueensStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/queens/place`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          cell: submission.cell,
          action: submission.action,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const queens = Array.isArray(response.queens)
        ? response.queens.filter((cell): cell is number => Number.isSafeInteger(cell))
        : [];
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setQuestion((current) =>
        current?.type === "queens"
          ? {
              ...current,
              progress: {
                kind: "queens",
                queens,
                placedQueens: Number(response.placedQueens),
                completedRows: Number(response.completedRows),
                completedColumns: Number(response.completedColumns),
                completedRegions: Number(response.completedRegions),
                conflictingQueens: Number(response.conflictingQueens),
                solved: response.solved === true,
              },
            }
          : current,
      );
      clearQueensStatusTimer();
      pendingQueensPlacementRef.current = null;
      setQueensState("idle");
      setQueensStatusVisible(false);
      setQueensError(undefined);
      if (response.terminal !== true) {
        setLocked(false);
        setBusy(false);
        return;
      }
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: { queens, marks: [] },
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      clearQueensStatusTimer();
      if (error instanceof CompetitiveCommandError && error.code === "prefilled_queen_locked") {
        pendingQueensPlacementRef.current = null;
        setQueensState("idle");
        setQueensStatusVisible(true);
        setQueensError("Esa corona es una pista fija.");
        setLocked(false);
      } else {
        setQueensState("error");
        setQueensStatusVisible(true);
        setQueensError("No hemos podido guardar el movimiento.");
      }
      setBusy(false);
    }
  };

  useEffect(() => {
    if (roomContext.attemptStatus !== "inProgress" || recoveryStarted.current) return;
    recoveryStarted.current = true;
    void recover().catch(() =>
      setStartNotice("No se ha podido recuperar la partida. Vuelve a intentarlo."),
    );
    // Recovery is single-shot per controller session; the ref also protects
    // this action from React Strict Mode effect replay in development.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomContext.attemptStatus]);

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    setStartNotice(undefined);
    try {
      const started = await postJson("/api/competitive/attempts/start", {
        scheduledChallengeId: challenge.id,
        idempotencyKey: idempotencyKey("start"),
      });
      setAttempt({ id: String(started.attemptId), lockVersion: Number(started.lockVersion) });
      setPhase("countdown");
    } catch (error) {
      setStartNotice(
        error instanceof CompetitiveCommandError && error.code === "attempt_control_required"
          ? "Tienes una partida en curso en otra sesión. Para este MVP, vuelve al dispositivo original para continuar."
          : "No se ha podido iniciar el desafío. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startQuestions = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      await prepare(attempt);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswerToServer = async (submission: PendingAnswerSubmission) => {
    startSubmissionStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(`/api/competitive/attempts/${submission.attemptId}/answer`, {
        lockVersion: submission.lockVersion,
        idempotencyKey: submission.idempotencyKey,
        challengeItemId: submission.challengeItemId,
        answer: submission.answer,
      });
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: submission.answer,
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points),
        timeUsed: Number(response.timeUsedMs) / 1000,
        ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
      };
      const nextResults = [...results, result];
      const nextLockVersion = Number(response.lockVersion);
      clearSubmissionStatusTimer();
      pendingSubmissionRef.current = null;
      setPendingAnswer(null);
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setSubmissionError(undefined);
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              {
                lockVersion: nextLockVersion,
                idempotencyKey: idempotencyKey("complete"),
              },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch {
      clearSubmissionStatusTimer();
      setSubmissionState("error");
      setSubmissionStatusVisible(true);
      setSubmissionError("No hemos podido confirmar tu respuesta.");
      setBusy(false);
    }
  };

  const submitMiniWordleToServer = async (submission: PendingMiniWordleSubmission) => {
    startSubmissionStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/mini-wordle/guess`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          guess: submission.guess,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const acceptedGuess = String(response.guess);
      const currentQuestion = question;
      const previousGuesses =
        currentQuestion?.type === "mini-wordle" ? currentQuestion.progress.guesses : [];
      const responseGuesses = Array.isArray(response.guesses)
        ? response.guesses.filter((guess): guess is string => typeof guess === "string")
        : [...previousGuesses, acceptedGuess];
      const feedback = Array.isArray(response.feedback) ? response.feedback : [];
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      clearSubmissionStatusTimer();
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setSubmissionError(undefined);
      pendingSubmissionRef.current = null;
      if (response.terminal !== true) {
        setQuestion((current) =>
          current?.type === "mini-wordle"
            ? {
                ...current,
                progress: {
                  kind: "mini-wordle",
                  guesses: responseGuesses,
                  feedback: [...current.progress.feedback, feedback],
                  attemptsUsed: Number(response.attemptsUsed),
                  maxAttempts: current.maxAttempts,
                },
              }
            : current,
        );
        setLocked(false);
        setBusy(false);
        return;
      }
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: { guesses: responseGuesses },
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      clearSubmissionStatusTimer();
      if (
        error instanceof CompetitiveCommandError &&
        (error.code === "invalid_mini_wordle_guess" || error.code === "duplicate_mini_wordle_guess")
      ) {
        pendingSubmissionRef.current = null;
        setSubmissionState("idle");
        setSubmissionStatusVisible(true);
        setSubmissionError(
          error.code === "duplicate_mini_wordle_guess"
            ? "Ya has probado esa palabra. El intento no se ha consumido."
            : "Esta palabra no está disponible para este desafío.",
        );
        setBusy(false);
        setLocked(false);
        return;
      }
      setSubmissionState("error");
      setSubmissionStatusVisible(true);
      setSubmissionError("No hemos podido confirmar tu palabra.");
      setBusy(false);
    }
  };

  const submitLogicCodeToServer = async (submission: PendingLogicCodeSubmission) => {
    startSubmissionStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/logic-code/attempt`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          code: submission.code,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      clearSubmissionStatusTimer();
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setSubmissionError(undefined);
      pendingSubmissionRef.current = null;

      if (response.terminal !== true) {
        setQuestion((current) =>
          current?.type === "logic-code"
            ? {
                ...current,
                progress: {
                  kind: "logic-code",
                  submittedCodes: [
                    ...current.progress.submittedCodes,
                    String(response.code ?? submission.code),
                  ],
                  incorrectAttempts: Number(response.incorrectAttempts),
                },
              }
            : current,
        );
        setLocked(false);
        setBusy(false);
        return;
      }

      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: String(response.code ?? submission.code),
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      clearSubmissionStatusTimer();
      if (
        error instanceof CompetitiveCommandError &&
        (error.code === "invalid_logic_code" || error.code === "duplicate_logic_code")
      ) {
        pendingSubmissionRef.current = null;
        setSubmissionState("idle");
        setSubmissionStatusVisible(true);
        setSubmissionError(
          error.code === "duplicate_logic_code"
            ? "Ya has probado ese código. El intento no se ha consumido."
            : "El código debe tener la longitud indicada y contener solo cifras.",
        );
        setBusy(false);
        setLocked(false);
        return;
      }
      setSubmissionState("error");
      setSubmissionStatusVisible(true);
      setSubmissionError("No hemos podido confirmar tu código.");
      setBusy(false);
    }
  };

  const revealProgressiveClueToServer = async (reveal: PendingProgressiveClueReveal) => {
    startRevealStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${reveal.attemptId}/progressive-clues/reveal`,
        {
          lockVersion: reveal.lockVersion,
          idempotencyKey: reveal.idempotencyKey,
          challengeItemId: reveal.challengeItemId,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const revealedClues = Number(response.revealedClues);
      const totalClues = Number(response.totalClues);
      const availablePoints = Number(response.availablePoints);
      const cluePenalty = Number(response.cluePenalty);
      const clue = String(response.clue);
      setAttempt({ id: reveal.attemptId, lockVersion: nextLockVersion });
      setQuestion((current) =>
        current?.type === "progressive-clues"
          ? {
              ...current,
              clues: [...current.clues, clue],
              totalClues,
              cluePenalty,
              progress: {
                kind: "progressive-clues",
                clues: [...current.progress.clues, clue],
                revealedClues,
                totalClues,
                availablePoints,
                cluePenalty,
              },
            }
          : current,
      );
      clearRevealStatusTimer();
      pendingRevealRef.current = null;
      setRevealState("idle");
      setRevealStatusVisible(false);
      setRevealError(undefined);
      setLocked(false);
      setBusy(false);
    } catch (error) {
      clearRevealStatusTimer();
      if (error instanceof CompetitiveCommandError && error.code === "all_clues_revealed") {
        pendingRevealRef.current = null;
        setRevealState("idle");
        setRevealStatusVisible(true);
        setRevealError("Ya has revelado todas las pistas.");
        setLocked(false);
      } else {
        setRevealState("error");
        setRevealStatusVisible(true);
        setRevealError("No hemos podido revelar la siguiente pista.");
      }
      setBusy(false);
    }
  };

  const submitMatchingPairToServer = async (submission: PendingMatchingPair) => {
    startMatchingStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/matching/pair`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          leftItemId: submission.leftItemId,
          rightItemId: submission.rightItemId,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const matchedPairs = Array.isArray(response.matchedPairs)
        ? response.matchedPairs.filter(
            (pair): pair is { leftId: string; rightId: string } =>
              Boolean(pair) &&
              typeof pair === "object" &&
              typeof (pair as Record<string, unknown>).leftId === "string" &&
              typeof (pair as Record<string, unknown>).rightId === "string",
          )
        : [];
      const correct = response.correct === true;
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setLastMatchingPair({
        leftId: submission.leftItemId,
        rightId: submission.rightItemId,
        correct,
      });
      setQuestion((current) =>
        current?.type === "matching"
          ? {
              ...current,
              progress: {
                kind: "matching",
                matchedPairs,
                matchedCount: Number(response.matchedCount),
                totalPairs: Number(response.totalPairs),
                incorrectAttempts: Number(response.incorrectAttempts),
                penaltyPoints: Number(response.penaltyPoints),
              },
            }
          : current,
      );
      clearMatchingStatusTimer();
      pendingMatchingPairRef.current = null;
      setMatchingState("idle");
      setMatchingStatusVisible(false);
      setMatchingError(undefined);
      if (response.terminal !== true) {
        setLocked(false);
        setBusy(false);
        return;
      }
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: Object.fromEntries(matchedPairs.map((pair) => [pair.leftId, pair.rightId])),
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      clearMatchingStatusTimer();
      const commandError = error instanceof CompetitiveCommandError ? error.code : "";
      if (
        commandError === "duplicate_matching_pair" ||
        commandError === "matching_item_already_resolved" ||
        commandError === "invalid_matching_pair"
      ) {
        pendingMatchingPairRef.current = null;
        setMatchingState("idle");
        setMatchingStatusVisible(true);
        setMatchingError(
          commandError === "matching_item_already_resolved"
            ? "Una de las tarjetas ya está resuelta."
            : commandError === "duplicate_matching_pair"
              ? "Esa pareja ya ha sido enviada."
              : "Esa pareja no está disponible.",
        );
        setLocked(false);
      } else {
        setMatchingState("error");
        setMatchingStatusVisible(true);
        setMatchingError("No hemos podido confirmar la pareja.");
      }
      setBusy(false);
    }
  };

  const submitWordSearchSelectionToServer = async (submission: PendingWordSearchSelection) => {
    startWordSearchStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/word-search/select`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          startCell: submission.startCell,
          endCell: submission.endCell,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const foundSelections = Array.isArray(response.foundSelections)
        ? response.foundSelections.filter((selection): selection is { targetId: string; startCell: number; endCell: number } =>
            Boolean(selection) && typeof selection === "object" && typeof (selection as Record<string, unknown>).targetId === "string" &&
            Number.isSafeInteger((selection as Record<string, unknown>).startCell) && Number.isSafeInteger((selection as Record<string, unknown>).endCell))
        : [];
      const foundWordIds = Array.isArray(response.foundWordIds)
        ? response.foundWordIds.filter((id): id is string => typeof id === "string")
        : foundSelections.map((selection) => selection.targetId);
      const correct = response.correct === true;
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setLastWordSearchSelection({ startCell: submission.startCell, endCell: submission.endCell, correct });
      setQuestion((current) =>
        current?.type === "word-search"
          ? {
              ...current,
              progress: {
                kind: "word-search",
                foundSelections,
                foundWordIds,
                foundCount: Number(response.foundCount),
                totalWords: Number(response.totalWords),
                incorrectAttempts: Number(response.incorrectAttempts),
              },
            }
          : current,
      );
      clearWordSearchStatusTimer();
      pendingWordSearchSelectionRef.current = null;
      setWordSearchState("idle");
      setWordSearchStatusVisible(false);
      setWordSearchError(undefined);
      if (response.terminal !== true) {
        setLocked(false);
        setBusy(false);
        return;
      }
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: { foundWordIds },
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: submission.attemptId, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ?? 1800,
      );
    } catch (error) {
      clearWordSearchStatusTimer();
      const commandError = error instanceof CompetitiveCommandError ? error.code : "";
      if (commandError === "word_search_target_already_found" || commandError === "invalid_word_search_selection") {
        pendingWordSearchSelectionRef.current = null;
        setWordSearchState("idle");
        setWordSearchStatusVisible(true);
        setWordSearchError(commandError === "word_search_target_already_found" ? "Esa palabra ya está encontrada." : "La selección no es válida.");
        setLocked(false);
      } else {
        setWordSearchState("error");
        setWordSearchStatusVisible(true);
        setWordSearchError("No hemos podido confirmar la selección.");
      }
      setBusy(false);
    }
  };

  const submit = async (answer: AnswerValue | null) => {
    if (!attempt || !question || locked || busy) return;
    const submission: PendingAnswerSubmission = {
      kind: "answer",
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      answer,
      idempotencyKey: idempotencyKey("answer"),
    };
    pendingSubmissionRef.current = submission;
    setPendingAnswer(answer);
    await submitAnswerToServer(submission);
  };

  const updateDraft = (answer: AnswerValue) => {
    if (
      !question ||
      (question.type !== "classification" &&
        question.type !== "estimation" &&
        question.type !== "heat-map" &&
        question.type !== "zip") ||
      locked ||
      busy
    ) {
      return;
    }
    setPendingAnswer(answer);
  };

  const submitMiniWordleGuess = async (guess: string) => {
    if (!attempt || !question || question.type !== "mini-wordle" || locked || busy) return;
    const submission: PendingMiniWordleSubmission = {
      kind: "mini-wordle",
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      guess,
      idempotencyKey: idempotencyKey("mini-wordle-guess"),
    };
    pendingSubmissionRef.current = submission;
    await submitMiniWordleToServer(submission);
  };

  const submitLogicCodeAttempt = async (code: string) => {
    if (!attempt || !question || question.type !== "logic-code" || locked || busy) return;
    const submission: PendingLogicCodeSubmission = {
      kind: "logic-code",
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      code,
      idempotencyKey: idempotencyKey("logic-code-attempt"),
    };
    pendingSubmissionRef.current = submission;
    await submitLogicCodeToServer(submission);
  };

  const revealProgressiveClue = async () => {
    if (!attempt || !question || question.type !== "progressive-clues" || locked || busy) return;
    const reveal: PendingProgressiveClueReveal = {
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      idempotencyKey: idempotencyKey("progressive-clue-reveal"),
    };
    pendingRevealRef.current = reveal;
    await revealProgressiveClueToServer(reveal);
  };

  const submitMatchingPair = async (leftId: string, rightId: string) => {
    if (!attempt || !question || question.type !== "matching" || locked || busy) return;
    const submission: PendingMatchingPair = {
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      leftItemId: leftId,
      rightItemId: rightId,
      idempotencyKey: idempotencyKey("matching-pair"),
    };
    pendingMatchingPairRef.current = submission;
    await submitMatchingPairToServer(submission);
  };

  const submitQueensPlacement = async (cell: number, action: "place" | "remove") => {
    if (!attempt || !question || question.type !== "queens" || locked || busy) return;
    const submission: PendingQueensPlacement = {
      kind: "queens",
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      cell,
      action,
      idempotencyKey: idempotencyKey("queens-placement"),
    };
    pendingQueensPlacementRef.current = submission;
    await submitQueensPlacementToServer(submission);
  };

  const submitWordSearchSelection = async (startCell: number, endCell: number) => {
    if (!attempt || !question || question.type !== "word-search" || locked || busy) return;
    const submission: PendingWordSearchSelection = {
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      startCell,
      endCell,
      idempotencyKey: idempotencyKey("word-search-selection"),
    };
    pendingWordSearchSelectionRef.current = submission;
    await submitWordSearchSelectionToServer(submission);
  };

  const retrySubmit = async () => {
    if (busy || !pendingSubmissionRef.current) return;
    const pending = pendingSubmissionRef.current;
    if (pending.kind === "mini-wordle") {
      await submitMiniWordleToServer(pending);
    } else if (pending.kind === "logic-code") {
      await submitLogicCodeToServer(pending);
    } else {
      await submitAnswerToServer(pending);
    }
  };

  const retryWordSearchSelection = async () => {
    if (busy || !pendingWordSearchSelectionRef.current) return;
    await submitWordSearchSelectionToServer(pendingWordSearchSelectionRef.current);
  };

  const retryReveal = async () => {
    if (busy || !pendingRevealRef.current) return;
    await revealProgressiveClueToServer(pendingRevealRef.current);
  };

  const retryMatchingPair = async () => {
    if (busy || !pendingMatchingPairRef.current) return;
    await submitMatchingPairToServer(pendingMatchingPairRef.current);
  };

  const retryQueensPlacement = async () => {
    if (busy || !pendingQueensPlacementRef.current) return;
    await submitQueensPlacementToServer(pendingQueensPlacementRef.current);
  };

  const abandon = async () => {
    if (!attempt || busy || !window.confirm("¿Abandonar este intento? No podrás retomarlo.")) {
      return;
    }
    setBusy(true);
    try {
      await postJson(`/api/competitive/attempts/${attempt.id}/abandon`, {
        lockVersion: attempt.lockVersion,
        confirm: true,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return {
    phase,
    attempt,
    questionIndex,
    question,
    questionPresentedAt,
    questionDeadlineAt,
    results,
    lastResult,
    score,
    reviewChallenge,
    locked,
    busy,
    submissionState,
    submissionStatusVisible,
    submissionError,
    revealState,
    revealStatusVisible,
    revealError,
    matchingState,
    matchingStatusVisible,
    matchingError,
    lastMatchingPair,
    queensState,
    queensStatusVisible,
    queensError,
    wordSearchState,
    wordSearchStatusVisible,
    wordSearchError,
    lastWordSearchSelection,
    pendingAnswer,
    startNotice,
    displayChallenge: display,
    begin,
    startQuestions,
    submit,
    updateDraft,
    submitMiniWordleGuess,
    submitLogicCodeAttempt,
    retrySubmit,
    revealProgressiveClue,
    retryReveal,
    submitMatchingPair,
    retryMatchingPair,
    submitQueensPlacement,
    retryQueensPlacement,
    submitWordSearchSelection,
    retryWordSearchSelection,
    abandon,
    showReview: () => setPhase("review"),
    showResults: () => setPhase("results"),
  };
}
