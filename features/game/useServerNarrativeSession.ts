"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswerValue } from "@/types/contracts";
import type {
  AnswerResult,
  FlashChallenge,
  ServerFlashQuestion,
  ServerFlashTerminalReview,
  ServerNarrativeChallenge,
  ServerNarrativeStep,
} from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import {
  questionFromPayload,
  questionWithSolution,
  terminalReviewFromResponse,
} from "@/features/game/serverFlashQuestionAdapter";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";

export type ServerNarrativePhase =
  | "intro"
  | "recovering"
  | "scene"
  | "preparing"
  | "playing"
  | "checking"
  | "transition"
  | "results"
  | "review";

type AttemptState = { id: string; lockVersion: number };
type SubmissionState = "idle" | "submitting" | "error";

class NarrativeCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function serverTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
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
    throw new NarrativeCommandError(code);
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

function answerResultFromResponse(
  challengeItemId: string,
  answer: AnswerValue | null,
  response: Record<string, unknown>,
): AnswerResult {
  const status = String(response.status) as AnswerResult["status"];
  return {
    questionId: challengeItemId,
    answer,
    status,
    isCorrect: status === "correct" || status === "partial",
    points: Number(response.points ?? 0),
    timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
    ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
  };
}

function answerResultsFromRecovery(value: unknown): AnswerResult[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const answer = entry as Record<string, unknown>;
    const status = String(answer.status) as AnswerResult["status"];
    return {
      questionId: String(answer.challengeItemId),
      answer: answer.answer as AnswerValue | null,
      status,
      isCorrect: status === "correct" || status === "partial",
      points: Number(answer.points ?? 0),
      timeUsed: Number(answer.timeUsedMs ?? 0) / 1000,
      ...(answer.resultDetails ? { details: answer.resultDetails as AnswerResult["details"] } : {}),
    };
  });
}

function reviewChallengeFor(
  challenge: ServerNarrativeChallenge,
  review: readonly ServerFlashTerminalReview[],
): FlashChallenge | null {
  if (review.length === 0) return null;
  const reviewById = new Map(review.map((row) => [row.challengeItemId, row]));
  try {
    const questions = [...challenge.slots]
      .sort((left, right) => left.position - right.position)
      .map((slot) => {
        const row = reviewById.get(slot.id);
        const serverQuestion = questionFromPayload(
          slot.id,
          row?.publicPayload,
          slot.timeLimitMs,
          slot.points,
          slot.questionType,
          undefined,
          true,
        );
        return questionWithSolution(serverQuestion, row);
      });
    return {
      id: challenge.id,
      definitionId: challenge.definitionId,
      number: challenge.number,
      title: challenge.title,
      subtitle: challenge.subtitle,
      description: challenge.description,
      mode: "flash",
      questions,
      questionPoints: Object.fromEntries(challenge.slots.map((slot) => [slot.id, slot.points])),
    };
  } catch {
    return null;
  }
}

function narrativeSequence(challenge: ServerNarrativeChallenge): ServerNarrativeStep[] {
  return [
    { type: "scene", scene: challenge.prologue },
    ...challenge.beats.flatMap((beat) => beat.steps),
  ];
}

function questionIndexFor(
  sequence: readonly ServerNarrativeStep[],
  challengeItemId: string | undefined,
) {
  if (!challengeItemId) return -1;
  return sequence.findIndex(
    (step) => step.type === "question" && step.questionId === challengeItemId,
  );
}

function previousSceneIndex(sequence: readonly ServerNarrativeStep[], fromIndex: number) {
  for (let index = Math.min(fromIndex, sequence.length - 1); index >= 0; index -= 1) {
    if (sequence[index]?.type === "scene") return index;
  }
  return 0;
}

export function useServerNarrativeSession({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerNarrativeChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const sequence = useMemo(() => narrativeSequence(challenge), [challenge]);
  const [phase, setPhase] = useState<ServerNarrativePhase>(
    roomContext.result
      ? "results"
      : roomContext.attemptStatus === "inProgress"
        ? "recovering"
        : "intro",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const attemptRef = useRef<AttemptState | null>(null);
  const [question, setQuestion] = useState<ServerFlashQuestion | null>(null);
  const [questionPresentedAt, setQuestionPresentedAt] = useState<number | null>(null);
  const [questionDeadlineAt, setQuestionDeadlineAt] = useState<number | null>(null);
  const initial = useMemo(() => initialResults(roomContext), [roomContext]);
  const [results, setResults] = useState<AnswerResult[]>(initial);
  const resultsRef = useRef(initial);
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionStatusVisible, setSubmissionStatusVisible] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();
  const [pendingAnswer, setPendingAnswer] = useState<AnswerValue | null>(null);
  const pendingAnswerRef = useRef<AnswerValue | null>(null);
  const [startNotice, setStartNotice] = useState<string>();
  const [reviewChallenge, setReviewChallenge] = useState<FlashChallenge | null>(() =>
    reviewChallengeFor(challenge, terminalReview ?? []),
  );
  const [attemptExpired, setAttemptExpired] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recoveryStarted = useRef(false);

  const currentStep = sequence[stepIndex];
  const questionNumber = sequence
    .slice(0, stepIndex + 1)
    .filter((step) => step.type === "question").length;

  const writeResults = (next: AnswerResult[]) => {
    resultsRef.current = next;
    setResults(next);
  };

  const markExpired = (error: unknown) => {
    if (!(error instanceof NarrativeCommandError) || error.code !== "attempt_inactivity_expired") {
      return false;
    }
    attemptRef.current = null;
    setAttempt(null);
    setAttemptExpired(true);
    setBusy(false);
    setLocked(true);
    setPhase("results");
    return true;
  };

  const clearQuestion = () => {
    setQuestion(null);
    setQuestionPresentedAt(null);
    setQuestionDeadlineAt(null);
    setPendingAnswer(null);
    pendingAnswerRef.current = null;
  };

  const prepare = async (currentAttempt: AttemptState) => {
    const prepared = await postJson(`/api/competitive/attempts/${currentAttempt.id}/prepare`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: idempotencyKey("prepare"),
    });
    const itemId = String(prepared.challengeItemId);
    const slot = challenge.slots.find((candidate) => candidate.id === itemId);
    if (!slot) throw new Error("competitive_question_not_found");
    const nextAttempt = { id: currentAttempt.id, lockVersion: Number(prepared.lockVersion) };
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
    const preparedIndex = questionIndexFor(sequence, itemId);
    if (preparedIndex >= 0) setStepIndex(preparedIndex);
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
    setQuestionPresentedAt(serverTimestamp(prepared.presentedAt));
    setQuestionDeadlineAt(serverTimestamp(prepared.deadlineAt));
    setLocked(Boolean(prepared.timedOut) || !prepared.deadlineAt);
    setSubmissionState("idle");
    setSubmissionStatusVisible(false);
    setSubmissionError(undefined);
    setBusy(false);
    setPhase("playing");
  };

  const complete = async (currentAttempt: AttemptState) => {
    const completed = await postJson(`/api/competitive/attempts/${currentAttempt.id}/complete`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: idempotencyKey("complete"),
    });
    const review = terminalReviewFromResponse(completed.review);
    setScore(Number(completed.score ?? 0));
    setReviewChallenge(reviewChallengeFor(challenge, review));
    setAttempt({ id: currentAttempt.id, lockVersion: Number(completed.lockVersion) });
    setQuestion(null);
    setQuestionPresentedAt(null);
    setQuestionDeadlineAt(null);
    setPhase("results");
    setBusy(false);
  };

  const advanceFrom = async (currentIndex: number, currentAttempt: AttemptState) => {
    const nextIndex = currentIndex + 1;
    const nextStep = sequence[nextIndex];
    clearQuestion();
    if (!nextStep) {
      await complete(currentAttempt);
      return;
    }
    setStepIndex(nextIndex);
    if (nextStep.type === "scene") {
      setBusy(false);
      setPhase("scene");
      return;
    }
    setPhase("preparing");
    await prepare(currentAttempt);
  };

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    setStartNotice(undefined);
    try {
      const started = await postJson("/api/competitive/attempts/start", {
        scheduledChallengeId: challenge.id,
        idempotencyKey: idempotencyKey("start"),
      });
      const currentAttempt = {
        id: String(started.attemptId),
        lockVersion: Number(started.lockVersion),
      };
      attemptRef.current = currentAttempt;
      setAttempt(currentAttempt);
      writeResults([]);
      setScore(0);
      setStepIndex(0);
      clearQuestion();
      setPhase("scene");
    } catch (error) {
      setStartNotice(
        error instanceof NarrativeCommandError && error.code === "attempt_control_required"
          ? "Tienes una partida en curso en otra sesión. Para este MVP, vuelve al dispositivo original para continuar."
          : "No se ha podido iniciar el desafío. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const continueScene = async () => {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || busy || phase !== "scene") return;
    setBusy(true);
    try {
      await advanceFrom(stepIndex, currentAttempt);
    } catch (error) {
      const expired = markExpired(error);
      if (!expired)
        setStartNotice("No hemos podido cargar la siguiente prueba. Inténtalo de nuevo.");
      setBusy(false);
      if (!expired) setPhase("scene");
    }
  };

  const submit = async (answer: AnswerValue | null) => {
    const currentAttempt = attemptRef.current;
    const currentQuestion = question;
    if (!currentAttempt || !currentQuestion || locked || busy || phase !== "playing") return;
    pendingAnswerRef.current = answer;
    setPendingAnswer(answer);
    setBusy(true);
    setLocked(true);
    setSubmissionState("submitting");
    setSubmissionStatusVisible(false);
    setSubmissionError(undefined);
    setPhase("checking");
    try {
      const response = await postJson(`/api/competitive/attempts/${currentAttempt.id}/answer`, {
        lockVersion: currentAttempt.lockVersion,
        idempotencyKey: idempotencyKey("answer"),
        challengeItemId: currentQuestion.id,
        answer,
      });
      const result = answerResultFromResponse(currentQuestion.id, answer, response);
      const nextResults = [...resultsRef.current, result];
      writeResults(nextResults);
      setLastResult(result);
      const nextAttempt = { id: currentAttempt.id, lockVersion: Number(response.lockVersion) };
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      setSubmissionState("idle");
      setSubmissionStatusVisible(false);
      setBusy(false);
      setPhase("transition");
      const duration =
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
        1800;
      transitionTimerRef.current = setTimeout(() => {
        void advanceFrom(questionIndexFor(sequence, currentQuestion.id), nextAttempt).catch(
          (error) => {
            if (!markExpired(error)) {
              setSubmissionState("error");
              setSubmissionStatusVisible(true);
              setSubmissionError("No hemos podido cargar el siguiente tramo.");
              setPhase("transition");
              setBusy(false);
            }
          },
        );
      }, duration);
    } catch (error) {
      if (markExpired(error)) return;
      setSubmissionState("error");
      setSubmissionStatusVisible(true);
      setSubmissionError("No hemos podido confirmar la respuesta. Puedes reintentarlo.");
      setLocked(false);
      setBusy(false);
      setPhase("playing");
    }
  };

  const retrySubmit = () => {
    void submit(pendingAnswerRef.current);
  };

  const recover = async () => {
    const started = await postJson("/api/competitive/attempts/start", {
      scheduledChallengeId: challenge.id,
      idempotencyKey: idempotencyKey("start"),
    });
    const startedAttempt = {
      id: String(started.attemptId),
      lockVersion: Number(started.lockVersion),
    };
    attemptRef.current = startedAttempt;
    setAttempt(startedAttempt);
    const response = await postJson(`/api/competitive/attempts/${startedAttempt.id}/recover`, {
      lockVersion: startedAttempt.lockVersion,
    });
    const recovered = answerResultsFromRecovery(response.answers);
    writeResults(recovered);
    const recoveredAttempt = {
      id: startedAttempt.id,
      lockVersion: Number(response.lockVersion),
    };
    attemptRef.current = recoveredAttempt;
    setAttempt(recoveredAttempt);
    if (response.phase === "results") {
      setScore(Number(response.score ?? roomContext.result?.flashPoints ?? 0));
      setReviewChallenge(
        reviewChallengeFor(challenge, terminalReviewFromResponse(response.review)),
      );
      setPhase("results");
      return;
    }
    const resolved = response.resolved as Record<string, unknown> | undefined;
    if (resolved && typeof resolved.challengeItemId === "string") {
      const resolvedIndex = questionIndexFor(sequence, resolved.challengeItemId);
      const result = recovered.find((entry) => entry.questionId === resolved.challengeItemId);
      if (resolvedIndex >= 0) {
        setStepIndex(resolvedIndex);
        setLastResult(result);
        setPhase("transition");
        transitionTimerRef.current = setTimeout(() => {
          void advanceFrom(resolvedIndex, recoveredAttempt);
        }, 300);
        return;
      }
    }
    const cursor =
      response.narrativeCursor && typeof response.narrativeCursor === "object"
        ? (response.narrativeCursor as Record<string, unknown>)
        : undefined;
    const activeItemId =
      typeof cursor?.currentChallengeItemId === "string"
        ? cursor.currentChallengeItemId
        : undefined;
    if (activeItemId) {
      const activeIndex = questionIndexFor(sequence, activeItemId);
      if (activeIndex >= 0) setStepIndex(activeIndex);
      setPhase("preparing");
      await prepare(recoveredAttempt);
      return;
    }
    const answeredIds = new Set(recovered.map((entry) => entry.questionId));
    const nextQuestionIndex = sequence.findIndex(
      (step) => step.type === "question" && !answeredIds.has(step.questionId),
    );
    if (nextQuestionIndex < 0) {
      await complete(recoveredAttempt);
      return;
    }
    setStepIndex(previousSceneIndex(sequence, nextQuestionIndex));
    setPhase("scene");
    setBusy(false);
  };

  useEffect(() => {
    if (roomContext.attemptStatus !== "inProgress" || recoveryStarted.current) return;
    recoveryStarted.current = true;
    void recover().catch((error) => {
      if (!markExpired(error)) {
        setStartNotice("No se ha podido recuperar la partida. Vuelve a intentarlo.");
        setPhase("intro");
      }
      setBusy(false);
    });
    // Recovery is intentionally single-shot; the ref also protects Strict Mode replays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomContext.attemptStatus]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  const showReview = () => {
    if (reviewChallenge) setPhase("review");
  };

  return {
    phase,
    stepIndex,
    questionNumber,
    currentStep,
    question,
    questionPresentedAt,
    questionDeadlineAt,
    results,
    lastResult,
    score,
    locked,
    busy,
    attempt,
    pendingAnswer,
    submissionState,
    submissionStatusVisible,
    submissionError,
    attemptExpired,
    startNotice,
    reviewChallenge,
    begin,
    continueScene,
    submit,
    retrySubmit,
    handleTimeUp: () => void submit(null),
    updateDraft: (answer: AnswerValue) => {
      pendingAnswerRef.current = answer;
      setPendingAnswer(answer);
    },
    // Narrative currently uses the generic answer command for all published
    // formats. These callbacks keep ServerFlashQuestionStage compatible for
    // future narrative payloads without exposing private solution data.
    submitMiniWordleGuess: (guess: string) => void submit(guess),
    submitLogicCodeAttempt: (code: string) => void submit(code),
    validateQueensBoard: (queens: readonly number[]) => {
      void queens;
    },
    updateQueensDraft: (queens: readonly number[]) => {
      void queens;
    },
    submitWordSearchSelection: (start: number, end: number) => {
      void start;
      void end;
    },
    submitWordHashtagSwap: (from: number, to: number) => {
      void from;
      void to;
    },
    revealProgressiveClue: () => undefined,
    retryQueensValidation: () => undefined,
    retryWordSearchSelection: () => undefined,
    retryReveal: () => undefined,
    queensState: "idle" as const,
    queensStatusVisible: false,
    queensError: undefined,
    wordSearchState: "idle" as const,
    wordSearchStatusVisible: false,
    wordSearchError: undefined,
    lastWordSearchSelection: undefined,
    revealState: "idle" as const,
    revealStatusVisible: false,
    revealError: undefined,
    showReview,
    showResults: () => setPhase("results"),
  };
}
