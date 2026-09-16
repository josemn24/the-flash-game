"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnswerResult,
  AnswerValue,
  FlashChallenge,
  GameRoomContext,
  Question,
} from "@/types/game";
import type { ServerFlashChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
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

class CompetitiveCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
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
  const [question, setQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(() => initialResults(roomContext));
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [reviewChallenge, setReviewChallenge] = useState<FlashChallenge | null>(() =>
    terminalReview?.length ? challengeWithReview(challenge, terminalReview) : null,
  );
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startNotice, setStartNotice] = useState<string>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recoveryStarted = useRef(false);
  const display = useMemo(() => displayChallenge(challenge), [challenge]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
    setAttempt({ id: currentAttempt.id, lockVersion: nextLockVersion });
    setQuestionIndex(nextIndex);
    setQuestion(questionFromPayload(itemId, prepared.publicPayload, slot.timeLimitMs, slot.points));
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
    if (!attempt) return;
    setBusy(true);
    try {
      await prepare(attempt);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (answer: AnswerValue | null) => {
    if (!attempt || !question || locked || busy) return;
    setBusy(true);
    setLocked(true);
    try {
      const response = await postJson(`/api/competitive/attempts/${attempt.id}/answer`, {
        lockVersion: attempt.lockVersion,
        idempotencyKey: idempotencyKey("answer"),
        challengeItemId: question.id,
        answer,
      });
      const result: AnswerResult = {
        questionId: question.id,
        answer,
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points),
        timeUsed: Number(response.timeUsedMs) / 1000,
      };
      const nextResults = [...results, result];
      const nextLockVersion = Number(response.lockVersion);
      setAttempt({ id: attempt.id, lockVersion: nextLockVersion });
      setResults(nextResults);
      setLastResult(result);
      setPhase("transition");
      timerRef.current = setTimeout(
        async () => {
          if (questionIndex === challenge.slots.length - 1) {
            const completed = await postJson(`/api/competitive/attempts/${attempt.id}/complete`, {
              lockVersion: nextLockVersion,
              idempotencyKey: idempotencyKey("complete"),
            });
            const review = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, review));
            setPhase("results");
          } else {
            await prepare({ id: attempt.id, lockVersion: nextLockVersion });
          }
          setBusy(false);
        },
        FLASH_POP_FEEDBACK_DURATION[result.status as keyof typeof FLASH_POP_FEEDBACK_DURATION] ??
          1800,
      );
    } catch (error) {
      setLocked(false);
      setBusy(false);
      throw error;
    }
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
    results,
    lastResult,
    score,
    reviewChallenge,
    locked,
    busy,
    startNotice,
    displayChallenge: display,
    begin,
    startQuestions,
    submit,
    abandon,
    showReview: () => setPhase("review"),
    showResults: () => setPhase("results"),
  };
}
