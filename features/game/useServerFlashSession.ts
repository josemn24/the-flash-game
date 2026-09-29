"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerResult, AnswerValue, FlashChallenge, GameRoomContext } from "@/types/game";
import { deriveSurvivalProgress } from "@/features/game/survivalRules";
import type {
  ServerFlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
  ServerPyramidChallenge,
} from "@/types/gameplay/challenge";
import type { PyramidChallenge } from "@/types/game";
import { WORD_HASHTAG_ACTIVE_CELLS } from "@/lib/wordHashtag";
import {
  FLASH_POP_FEEDBACK_DURATION,
  MINI_WORDLE_ANSWER_REVEAL_DURATION,
} from "@/features/game/transitionTiming";
import { deriveCompetitivePyramidProgress } from "@/features/pyramid/pyramidRules";
import {
  challengeWithReview,
  displayChallenge,
  questionFromPayload,
  terminalReviewFromResponse,
} from "@/features/game/serverFlashQuestionAdapter";

export type ServerFlashPhase =
  | "intro"
  | "recovering"
  | "countdown"
  | "briefing"
  | "preparing"
  | "playing"
  | "checking"
  | "answer-reveal"
  | "transition"
  | "results"
  | "review";

type ServerPlayableChallenge =
  ServerFlashChallenge | ServerSurvivalChallenge | ServerPyramidChallenge;

function terminalReviewChallenge(
  challenge: ServerPlayableChallenge,
  review: readonly ServerFlashTerminalReview[],
) {
  if (challenge.mode === "pyramid") return challengeWithReview(challenge, review);
  return challengeWithReview(challenge, review);
}

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
type PendingWordHashtagSubmission = {
  kind: "word-hashtag";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  fromCell: number;
  toCell: number;
  idempotencyKey: string;
};
type PendingProgressiveClueReveal = {
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
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
type PendingQueensValidation = {
  kind: "queens";
  attemptId: string;
  lockVersion: number;
  challengeItemId: string;
  queens: readonly number[];
  idempotencyKey: string;
};
type PendingSubmission =
  | PendingAnswerSubmission
  | PendingMiniWordleSubmission
  | PendingLogicCodeSubmission
  | PendingWordHashtagSubmission;

type PyramidPreparation = {
  readonly attemptId: string;
  readonly challengeItemId: string;
  readonly prepareKey: string;
  readonly activateKey: string;
};

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
  challenge: ServerPlayableChallenge;
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
  const attemptRef = useRef<AttemptState | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState<ServerFlashQuestion | null>(null);
  const [questionPresentedAt, setQuestionPresentedAt] = useState<number | null>(null);
  const [questionDeadlineAt, setQuestionDeadlineAt] = useState<number | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(() => initialResults(roomContext));
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [reviewChallenge, setReviewChallenge] = useState<FlashChallenge | PyramidChallenge | null>(
    () => (terminalReview?.length ? terminalReviewChallenge(challenge, terminalReview) : null),
  );
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionStatusVisible, setSubmissionStatusVisible] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const [answerVerificationState, setAnswerVerificationState] = useState<SubmissionState>("idle");
  const [answerVerificationStatusVisible, setAnswerVerificationStatusVisible] = useState(false);
  const [answerVerificationError, setAnswerVerificationError] = useState<string>();
  const [revealState, setRevealState] = useState<SubmissionState>("idle");
  const [revealStatusVisible, setRevealStatusVisible] = useState(false);
  const [revealError, setRevealError] = useState<string>();
  const [queensState, setQueensState] = useState<SubmissionState>("idle");
  const [queensStatusVisible, setQueensStatusVisible] = useState(false);
  const [queensError, setQueensError] = useState<string>();
  const [wordSearchState, setWordSearchState] = useState<SubmissionState>("idle");
  const [wordSearchStatusVisible, setWordSearchStatusVisible] = useState(false);
  const [wordSearchError, setWordSearchError] = useState<string>();
  const [lastWordSearchSelection, setLastWordSearchSelection] = useState<
    { readonly startCell: number; readonly endCell: number; readonly correct: boolean } | undefined
  >();
  const [pendingAnswer, setPendingAnswer] = useState<AnswerValue | null>(null);
  const [startNotice, setStartNotice] = useState<string>();
  const [levelNotice, setLevelNotice] = useState<string>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submissionStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const answerVerificationStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const revealStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queensStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordSearchStatusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSubmissionRef = useRef<PendingSubmission | null>(null);
  const pendingRevealRef = useRef<PendingProgressiveClueReveal | null>(null);
  const pendingQueensValidationRef = useRef<PendingQueensValidation | null>(null);
  const latestQueensDraftRef = useRef<readonly number[] | null>(null);
  const queensDraftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queensDraftQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWordSearchSelectionRef = useRef<PendingWordSearchSelection | null>(null);
  const pyramidPreparationRef = useRef<PyramidPreparation | null>(null);
  const [pyramidPreparation, setPyramidPreparation] = useState<PyramidPreparation | null>(null);
  const pyramidActivationInFlight = useRef(false);
  const pyramidStartInFlight = useRef(false);
  const recoveryStarted = useRef(false);
  const [attemptExpired, setAttemptExpired] = useState(false);
  const display = useMemo(() => displayChallenge(challenge), [challenge]);

  const markAttemptExpired = (error: unknown) => {
    if (
      !(error instanceof CompetitiveCommandError) ||
      error.code !== "attempt_inactivity_expired"
    ) {
      return false;
    }
    clearSubmissionStatusTimer();
    clearAnswerVerificationStatusTimer();
    clearRevealStatusTimer();
    clearQueensStatusTimer();
    clearWordSearchStatusTimer();
    attemptRef.current = null;
    setAttempt(null);
    setAttemptExpired(true);
    setQuestion(null);
    setQuestionPresentedAt(null);
    setQuestionDeadlineAt(null);
    setReviewChallenge(null);
    setScore(0);
    setLocked(true);
    setBusy(false);
    setPhase("results");
    pendingSubmissionRef.current = null;
    pendingRevealRef.current = null;
    pendingQueensValidationRef.current = null;
    pendingWordSearchSelectionRef.current = null;
    return true;
  };

  const isTerminalForMode = (candidateResults: readonly AnswerResult[]) => {
    if (challenge.mode === "pyramid") {
      return (
        deriveCompetitivePyramidProgress(challenge.levels.length, candidateResults).outcome !==
        "in_progress"
      );
    }
    if (challenge.mode === "survival") {
      return (
        deriveSurvivalProgress(challenge.lives, challenge.slots.length, candidateResults)
          .outcome !== "in_progress"
      );
    }
    return questionIndex >= challenge.slots.length - 1;
  };
  const survivalProgress =
    challenge.mode === "survival"
      ? deriveSurvivalProgress(challenge.lives, challenge.slots.length, results)
      : null;
  const pyramidProgress =
    challenge.mode === "pyramid"
      ? deriveCompetitivePyramidProgress(challenge.levels.length, results)
      : null;

  const advanceToNextQuestion = async (
    attemptId: string,
    lockVersion: number,
    nextResults: AnswerResult[],
  ) => {
    if (challenge.mode === "pyramid") {
      setQuestionIndex(nextResults.length);
      setQuestion(null);
      setQuestionPresentedAt(null);
      setQuestionDeadlineAt(null);
      pyramidPreparationRef.current = null;
      setPyramidPreparation(null);
      setPhase("briefing");
      return;
    }
    await prepare({ id: attemptId, lockVersion });
  };

  const clearSubmissionStatusTimer = () => {
    if (submissionStatusTimerRef.current) {
      clearTimeout(submissionStatusTimerRef.current);
      submissionStatusTimerRef.current = undefined;
    }
  };

  const clearAnswerVerificationStatusTimer = () => {
    if (answerVerificationStatusTimerRef.current) {
      clearTimeout(answerVerificationStatusTimerRef.current);
      answerVerificationStatusTimerRef.current = undefined;
    }
  };

  const startAnswerVerification = () => {
    clearAnswerVerificationStatusTimer();
    clearSubmissionStatusTimer();
    setAnswerVerificationState("submitting");
    setAnswerVerificationStatusVisible(false);
    setAnswerVerificationError(undefined);
    setSubmissionState("idle");
    setSubmissionStatusVisible(false);
    setSubmissionError(undefined);
    setPhase("checking");
    answerVerificationStatusTimerRef.current = setTimeout(() => {
      setAnswerVerificationStatusVisible(true);
      answerVerificationStatusTimerRef.current = undefined;
    }, SUBMISSION_STATUS_DELAY_MS);
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

  const persistQueensDraft = async (queens: readonly number[]) => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || !question || question.type !== "queens") return;
    try {
      const response = await postJson(
        `/api/competitive/attempts/${currentAttempt.id}/queens/draft`,
        {
          lockVersion: currentAttempt.lockVersion,
          idempotencyKey: idempotencyKey("queens-draft"),
          challengeItemId: question.id,
          queens,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const nextAttempt = { id: currentAttempt.id, lockVersion: nextLockVersion };
      attemptRef.current = nextAttempt;
      setAttempt((current) => (current?.id === currentAttempt.id ? nextAttempt : current));
    } catch (error) {
      markAttemptExpired(error);
      // Draft persistence is best effort. The authoritative validation still sends the full board.
    }
  };

  const enqueueQueensDraft = () => {
    const queens = latestQueensDraftRef.current;
    if (!queens) return queensDraftQueueRef.current;
    latestQueensDraftRef.current = null;
    const next = queensDraftQueueRef.current.then(() => persistQueensDraft(queens));
    queensDraftQueueRef.current = next.catch(() => undefined);
    return next;
  };

  const scheduleQueensDraft = (queens: readonly number[]) => {
    latestQueensDraftRef.current = [...queens];
    if (queensDraftTimerRef.current) clearTimeout(queensDraftTimerRef.current);
    queensDraftTimerRef.current = setTimeout(() => {
      queensDraftTimerRef.current = undefined;
      void enqueueQueensDraft();
    }, 300);
  };

  const flushQueensDraft = async (queens: readonly number[]) => {
    if (queensDraftTimerRef.current) {
      clearTimeout(queensDraftTimerRef.current);
      queensDraftTimerRef.current = undefined;
    }
    latestQueensDraftRef.current = [...queens];
    await enqueueQueensDraft();
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
      clearAnswerVerificationStatusTimer();
      clearRevealStatusTimer();
      clearQueensStatusTimer();
      clearWordSearchStatusTimer();
      if (queensDraftTimerRef.current) clearTimeout(queensDraftTimerRef.current);
    },
    [],
  );

  const prepare = async (
    currentAttempt: AttemptState,
    prepareKey = idempotencyKey("prepare"),
    activateKey = idempotencyKey("activate"),
  ) => {
    const prepared = await postJson(`/api/competitive/attempts/${currentAttempt.id}/prepare`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: prepareKey,
    });
    const nextLockVersion = Number(prepared.lockVersion);
    const itemId = String(prepared.challengeItemId);
    const challengeSlots = challenge.mode === "pyramid" ? challenge.levels : challenge.slots;
    const nextIndex = challengeSlots.findIndex((item) => item.id === itemId);
    if (nextIndex < 0) throw new Error("competitive_question_not_found");
    const slot = challengeSlots[nextIndex]!;
    const presentedAt = prepared.presentedAt ? serverTimestamp(prepared.presentedAt) : null;
    const deadlineAt = prepared.deadlineAt ? serverTimestamp(prepared.deadlineAt) : null;
    const nextAttempt = { id: currentAttempt.id, lockVersion: nextLockVersion };
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
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
    setQueensState("idle");
    setQueensStatusVisible(false);
    setQueensError(undefined);
    pendingQueensValidationRef.current = null;
    latestQueensDraftRef.current = null;
    if (queensDraftTimerRef.current) {
      clearTimeout(queensDraftTimerRef.current);
      queensDraftTimerRef.current = undefined;
    }
    queensDraftQueueRef.current = Promise.resolve();
    setWordSearchState("idle");
    setWordSearchStatusVisible(false);
    setWordSearchError(undefined);
    setLastWordSearchSelection(undefined);
    pendingWordSearchSelectionRef.current = null;
    clearAnswerVerificationStatusTimer();
    setAnswerVerificationState("idle");
    setAnswerVerificationStatusVisible(false);
    setAnswerVerificationError(undefined);
    setLocked(deadlineAt === null ? true : Boolean(prepared.timedOut));
    if (challenge.mode === "pyramid" && deadlineAt === null) {
      const nextPreparation = {
        attemptId: currentAttempt.id,
        challengeItemId: itemId,
        prepareKey,
        activateKey,
      } satisfies PyramidPreparation;
      pyramidPreparationRef.current = nextPreparation;
      setPyramidPreparation(nextPreparation);
      setPhase("preparing");
    } else {
      setPhase("playing");
      setBusy(false);
    }
  };

  const activatePreparedPyramid = async (preparation: PyramidPreparation) => {
    if (pyramidActivationInFlight.current || !attemptRef.current) return;
    pyramidActivationInFlight.current = true;
    try {
      const activated = await postJson(
        `/api/competitive/attempts/${preparation.attemptId}/activate`,
        {
          lockVersion: attemptRef.current.lockVersion,
          challengeItemId: preparation.challengeItemId,
          idempotencyKey: preparation.activateKey,
        },
      );
      const nextAttempt = {
        id: preparation.attemptId,
        lockVersion: Number(activated.lockVersion),
      };
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      setQuestionPresentedAt(serverTimestamp(activated.presentedAt));
      setQuestionDeadlineAt(serverTimestamp(activated.deadlineAt));
      setLocked(Boolean(activated.timedOut));
      setLevelNotice(undefined);
      pyramidPreparationRef.current = null;
      setPyramidPreparation(null);
      setPhase("playing");
      setBusy(false);
    } catch (error) {
      if (markAttemptExpired(error)) return;
      setQuestion(null);
      setQuestionPresentedAt(null);
      setQuestionDeadlineAt(null);
      setLocked(false);
      setLevelNotice("No hemos podido activar la prueba. Puedes reintentar la carga.");
      setPhase("briefing");
      setBusy(false);
    } finally {
      pyramidActivationInFlight.current = false;
      pyramidStartInFlight.current = false;
    }
  };

  useEffect(() => {
    if (
      challenge.mode !== "pyramid" ||
      phase !== "preparing" ||
      !question ||
      !pyramidPreparation ||
      pyramidActivationInFlight.current
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      void activatePreparedPyramid(pyramidPreparation);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [challenge.mode, phase, question, pyramidPreparation]);

  const recover = async () => {
    const started = await postJson("/api/competitive/attempts/start", {
      scheduledChallengeId: challenge.id,
      idempotencyKey: idempotencyKey("start"),
    });
    const currentAttempt: AttemptState = {
      id: String(started.attemptId),
      lockVersion: Number(started.lockVersion),
    };
    attemptRef.current = currentAttempt;
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
            ...(item.resultDetails
              ? { details: item.resultDetails as AnswerResult["details"] }
              : {}),
          } satisfies AnswerResult;
        })
      : [];
    setResults(recoveredResults);
    const recoveredAttempt = { id: currentAttempt.id, lockVersion: Number(response.lockVersion) };
    attemptRef.current = recoveredAttempt;
    setAttempt(recoveredAttempt);
    if (response.phase === "results") {
      const rows = terminalReviewFromResponse(response.review);
      setScore(Number(response.score ?? 0));
      setReviewChallenge(rows.length ? terminalReviewChallenge(challenge, rows) : null);
      setQuestionPresentedAt(null);
      setQuestionDeadlineAt(null);
      setPhase("results");
    } else if (response.phase === "briefing") {
      setQuestionIndex(recoveredResults.length);
      setPhase("briefing");
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

  const submitQueensBoardToServer = async (submission: PendingQueensValidation) => {
    startQueensStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/queens/validate`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          queens: submission.queens,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const queens = Array.isArray(response.queens)
        ? response.queens.filter((cell): cell is number => Number.isSafeInteger(cell))
        : [];
      const nextAttempt = { id: submission.attemptId, lockVersion: nextLockVersion };
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
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
      pendingQueensValidationRef.current = null;
      setQueensState("idle");
      setQueensStatusVisible(response.terminal === true ? false : true);
      if (response.terminal !== true) {
        setQueensError("El tablero no es correcto. Revisa las coronas en conflicto y continúa.");
        setLocked(false);
        setBusy(false);
        return;
      }
      setQueensError(undefined);
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: { queens, marks: [] },
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
        ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (isTerminalForMode(nextResults)) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(terminalReviewChallenge(challenge, review));
            setPhase("results");
          } else {
            await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      if (markAttemptExpired(error)) return;
      clearQueensStatusTimer();
      setQueensState("error");
      setQueensStatusVisible(true);
      setQueensError(
        error instanceof CompetitiveCommandError && error.code === "queens_answer_incomplete"
          ? question?.type === "queens"
            ? `Completa las ${question.grid.rows} coronas para validar el tablero.`
            : "Completa el tablero para validar la respuesta."
          : "No hemos podido validar el tablero. Puedes reintentarlo.",
      );
      setBusy(false);
    }
  };

  useEffect(() => {
    if (roomContext.attemptStatus !== "inProgress" || recoveryStarted.current) return;
    recoveryStarted.current = true;
    void recover().catch((error) => {
      if (!markAttemptExpired(error)) {
        setStartNotice("No se ha podido recuperar la partida. Vuelve a intentarlo.");
      }
    });
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
      setPhase(challenge.mode === "pyramid" ? "briefing" : "countdown");
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
    if (!attempt || busy || pyramidStartInFlight.current) return;
    if (challenge.mode === "pyramid") pyramidStartInFlight.current = true;
    setBusy(true);
    setLevelNotice(undefined);
    if (challenge.mode === "pyramid") setPhase("preparing");
    const currentPreparation = pyramidPreparationRef.current;
    const prepareKey =
      currentPreparation?.attemptId === attempt.id
        ? currentPreparation.prepareKey
        : idempotencyKey("prepare");
    const activateKey =
      currentPreparation?.attemptId === attempt.id
        ? currentPreparation.activateKey
        : idempotencyKey("activate");
    let waitingForActivation = false;
    try {
      await prepare(attempt, prepareKey, activateKey);
      waitingForActivation =
        challenge.mode === "pyramid" && pyramidPreparationRef.current?.attemptId === attempt.id;
    } catch (error) {
      if (markAttemptExpired(error)) return;
      setLevelNotice("No hemos podido cargar la prueba. Puedes reintentarlo.");
      setPhase("briefing");
      setBusy(false);
    } finally {
      if (!waitingForActivation) pyramidStartInFlight.current = false;
      if (challenge.mode !== "pyramid") setBusy(false);
    }
  };

  const submitAnswerToServer = async (submission: PendingAnswerSubmission) => {
    startAnswerVerification();
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
      clearAnswerVerificationStatusTimer();
      pendingSubmissionRef.current = null;
      setPendingAnswer(null);
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setSubmissionError(undefined);
      setAnswerVerificationState("idle");
      setAnswerVerificationStatusVisible(false);
      setAnswerVerificationError(undefined);
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (isTerminalForMode(nextResults)) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              {
                lockVersion: nextLockVersion,
                idempotencyKey: idempotencyKey("complete"),
              },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(terminalReviewChallenge(challenge, review));
            setPhase("results");
          } else {
            await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      if (markAttemptExpired(error)) return;
      clearAnswerVerificationStatusTimer();
      if (error instanceof CompetitiveCommandError && error.code === "invalid_matching_answer") {
        setAnswerVerificationState("idle");
        setAnswerVerificationStatusVisible(false);
        setAnswerVerificationError(undefined);
        setSubmissionState("error");
        setSubmissionStatusVisible(true);
        setSubmissionError("La respuesta de parejas no es válida. Revisa todas las asociaciones.");
        setPhase("playing");
        setLocked(false);
      } else {
        setAnswerVerificationState("error");
        setAnswerVerificationStatusVisible(true);
        setAnswerVerificationError("No hemos podido confirmar tu respuesta.");
      }
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
      const showTransition = () => {
        setPhase("transition");
        timerRef.current = setTimeout(
          async () => {
            if (isTerminalForMode(nextResults)) {
              const completed = await postJson(
                `/api/competitive/attempts/${submission.attemptId}/complete`,
                { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
              );
              const review = terminalReviewFromResponse(completed.review);
              setScore(Number(completed.score ?? 0));
              setReviewChallenge(terminalReviewChallenge(challenge, review));
              setPhase("results");
            } else {
              await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
            }
            setBusy(false);
          },
          FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
            1800,
        );
      };
      const revealMiniWordleAnswer =
        challenge.mode === "pyramid" &&
        currentQuestion?.type === "mini-wordle" &&
        response.status === "correct";
      if (revealMiniWordleAnswer) {
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
        setQuestionDeadlineAt(null);
        setPhase("answer-reveal");
        timerRef.current = setTimeout(showTransition, MINI_WORDLE_ANSWER_REVEAL_DURATION);
      } else {
        showTransition();
      }
    } catch (error) {
      if (markAttemptExpired(error)) return;
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
          if (isTerminalForMode(nextResults)) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(terminalReviewChallenge(challenge, review));
            setPhase("results");
          } else {
            await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      if (markAttemptExpired(error)) return;
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

  const submitWordHashtagToServer = async (submission: PendingWordHashtagSubmission) => {
    startSubmissionStatus();
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(
        `/api/competitive/attempts/${submission.attemptId}/word-hashtag/swap`,
        {
          lockVersion: submission.lockVersion,
          idempotencyKey: submission.idempotencyKey,
          challengeItemId: submission.challengeItemId,
          fromCell: submission.fromCell,
          toCell: submission.toCell,
        },
      );
      const nextLockVersion = Number(response.lockVersion);
      const responseLetters = Array.isArray(response.letters)
        ? response.letters.filter(
            (letter): letter is string | null => letter === null || typeof letter === "string",
          )
        : [];
      const responseCorrectCells = Array.isArray(response.correctCells)
        ? response.correctCells
        : [];
      const validResponseCorrectCells = responseCorrectCells.every(
        (cell, index) =>
          Number.isSafeInteger(cell) &&
          cell >= 0 &&
          cell < 25 &&
          WORD_HASHTAG_ACTIVE_CELLS.includes(cell) &&
          responseLetters.length === 25 &&
          responseLetters[cell] !== null &&
          (index === 0 || responseCorrectCells[index - 1]! < cell),
      );
      const nextAttempt = { id: submission.attemptId, lockVersion: nextLockVersion };
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      setQuestion((current) =>
        current?.type === "word-hashtag"
          ? {
              ...current,
              progress: {
                kind: "word-hashtag",
                letters: responseLetters.length === 25 ? responseLetters : current.progress.letters,
                correctCells: validResponseCorrectCells
                  ? (responseCorrectCells as number[])
                  : current.progress.correctCells,
                swaps: [
                  ...current.progress.swaps,
                  { fromCell: submission.fromCell, toCell: submission.toCell },
                ],
                movesUsed: Number(response.movesUsed),
                movesRemaining: Number(response.movesRemaining),
              },
            }
          : current,
      );
      clearSubmissionStatusTimer();
      pendingSubmissionRef.current = null;
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setSubmissionError(undefined);
      if (response.terminal !== true) {
        setLocked(false);
        setBusy(false);
        return;
      }
      const swaps =
        question?.type === "word-hashtag"
          ? [
              ...question.progress.swaps,
              { fromCell: submission.fromCell, toCell: submission.toCell },
            ]
          : [{ fromCell: submission.fromCell, toCell: submission.toCell }];
      const result: AnswerResult = {
        questionId: submission.challengeItemId,
        answer: { swaps },
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
        ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (isTerminalForMode(nextResults)) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(terminalReviewChallenge(challenge, review));
            setPhase("results");
          } else {
            await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      if (markAttemptExpired(error)) return;
      clearSubmissionStatusTimer();
      if (error instanceof CompetitiveCommandError && error.code === "invalid_word_hashtag_swap") {
        pendingSubmissionRef.current = null;
        setSubmissionState("error");
        setSubmissionStatusVisible(true);
        setSubmissionError("Ese intercambio no está permitido.");
        setLocked(false);
      } else {
        setSubmissionState("error");
        setSubmissionStatusVisible(true);
        setSubmissionError("No hemos podido guardar el intercambio.");
      }
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
      const nextAttempt = { id: reveal.attemptId, lockVersion: nextLockVersion };
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
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
      if (markAttemptExpired(error)) return;
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
        ? response.foundSelections.filter(
            (selection): selection is { targetId: string; startCell: number; endCell: number } =>
              Boolean(selection) &&
              typeof selection === "object" &&
              typeof (selection as Record<string, unknown>).targetId === "string" &&
              Number.isSafeInteger((selection as Record<string, unknown>).startCell) &&
              Number.isSafeInteger((selection as Record<string, unknown>).endCell),
          )
        : [];
      const foundWordIds = Array.isArray(response.foundWordIds)
        ? response.foundWordIds.filter((id): id is string => typeof id === "string")
        : foundSelections.map((selection) => selection.targetId);
      const correct = response.correct === true;
      setAttempt({ id: submission.attemptId, lockVersion: nextLockVersion });
      setLastWordSearchSelection({
        startCell: submission.startCell,
        endCell: submission.endCell,
        correct,
      });
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
        ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
      };
      const nextResults = [...results, result];
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (isTerminalForMode(nextResults)) {
            const completed = await postJson(
              `/api/competitive/attempts/${submission.attemptId}/complete`,
              { lockVersion: nextLockVersion, idempotencyKey: idempotencyKey("complete") },
            );
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(terminalReviewChallenge(challenge, review));
            setPhase("results");
          } else {
            await advanceToNextQuestion(submission.attemptId, nextLockVersion, nextResults);
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      if (markAttemptExpired(error)) return;
      clearWordSearchStatusTimer();
      const commandError = error instanceof CompetitiveCommandError ? error.code : "";
      if (
        commandError === "word_search_target_already_found" ||
        commandError === "invalid_word_search_selection"
      ) {
        pendingWordSearchSelectionRef.current = null;
        setWordSearchState("idle");
        setWordSearchStatusVisible(true);
        setWordSearchError(
          commandError === "word_search_target_already_found"
            ? "Esa palabra ya está encontrada."
            : "La selección no es válida.",
        );
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
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || !question || locked || busy) return;
    const submission: PendingAnswerSubmission = {
      kind: "answer",
      attemptId: currentAttempt.id,
      lockVersion: currentAttempt.lockVersion,
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
        question.type !== "zip" &&
        question.type !== "escape" &&
        question.type !== "matching") ||
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

  const submitWordHashtagSwap = async (fromCell: number, toCell: number) => {
    if (!attempt || !question || question.type !== "word-hashtag" || locked || busy) return;
    const submission: PendingWordHashtagSubmission = {
      kind: "word-hashtag",
      attemptId: attempt.id,
      lockVersion: attempt.lockVersion,
      challengeItemId: question.id,
      fromCell,
      toCell,
      idempotencyKey: idempotencyKey("word-hashtag-swap"),
    };
    pendingSubmissionRef.current = submission;
    await submitWordHashtagToServer(submission);
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

  const updateQueensDraft = (queens: readonly number[]) => {
    if (!question || question.type !== "queens" || locked || busy) return;
    const answer = { queens: [...queens], marks: [] } satisfies AnswerValue;
    setPendingAnswer(answer);
    scheduleQueensDraft(queens);
  };

  const validateQueensBoard = async (queens: readonly number[]) => {
    if (!question || question.type !== "queens" || locked || busy) return;
    await flushQueensDraft(queens);
    const currentAttempt = attemptRef.current;
    if (!currentAttempt) return;
    const submission: PendingQueensValidation = {
      kind: "queens",
      attemptId: currentAttempt.id,
      lockVersion: currentAttempt.lockVersion,
      challengeItemId: question.id,
      queens: [...queens],
      idempotencyKey: idempotencyKey("queens-validation"),
    };
    pendingQueensValidationRef.current = submission;
    await submitQueensBoardToServer(submission);
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
    } else if (pending.kind === "word-hashtag") {
      await submitWordHashtagToServer(pending);
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

  const retryQueensValidation = async () => {
    if (busy || !pendingQueensValidationRef.current) return;
    await submitQueensBoardToServer(pendingQueensValidationRef.current);
  };

  const handleTimeUp = async () => {
    if (question?.type === "queens") {
      await flushQueensDraft(latestQueensDraftRef.current ?? question.progress.queens);
    }
    await submit(
      question?.type === "classification" ||
        question?.type === "estimation" ||
        question?.type === "heat-map" ||
        question?.type === "zip" ||
        question?.type === "escape" ||
        question?.type === "matching"
        ? pendingAnswer
        : null,
    );
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
    attemptExpired,
    attempt,
    questionIndex,
    isTerminalQuestion: isTerminalForMode(results),
    survivalProgress,
    pyramidProgress,
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
    answerVerificationState,
    answerVerificationStatusVisible,
    answerVerificationError,
    revealState,
    revealStatusVisible,
    revealError,
    queensState,
    queensStatusVisible,
    queensError,
    wordSearchState,
    wordSearchStatusVisible,
    wordSearchError,
    lastWordSearchSelection,
    pendingAnswer,
    startNotice,
    levelNotice,
    displayChallenge: display,
    begin,
    startQuestions,
    submit,
    updateDraft,
    submitMiniWordleGuess,
    submitLogicCodeAttempt,
    submitWordHashtagSwap,
    retrySubmit,
    revealProgressiveClue,
    retryReveal,
    updateQueensDraft,
    validateQueensBoard,
    retryQueensValidation,
    handleTimeUp,
    submitWordSearchSelection,
    retryWordSearchSelection,
    abandon,
    showReview: () => setPhase("review"),
    showResults: () => setPhase("results"),
  };
}
