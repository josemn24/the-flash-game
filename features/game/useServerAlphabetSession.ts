"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerResult, GameRoomContext } from "@/types/game";
import type {
  ServerAlphabetChallenge,
  ServerAlphabetProgress,
  ServerAlphabetQuestion,
  ServerFlashTerminalReview,
} from "@/types/gameplay/challenge";
import { createAlphabetTimeoutGuard } from "./alphabetTimeoutGuard";
import {
  alphabetChallengeWithReview,
  questionFromAlphabetPayload,
} from "./serverAlphabetQuestionAdapter";

export type ServerAlphabetPhase =
  "intro" | "recovering" | "countdown" | "playing" | "results" | "review";

type AttemptState = { id: string; lockVersion: number };

class CompetitiveCommandError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

function rateLimitMessage(error: unknown): string | undefined {
  if (!(error instanceof CompetitiveCommandError) || error.status !== 429) return undefined;
  const seconds = error.retryAfterSeconds ?? 1;
  return `Demasiadas solicitudes. Espera ${seconds} ${seconds === 1 ? "segundo" : "segundos"} antes de volver a intentarlo.`;
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
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new CompetitiveCommandError(
      code,
      response.status,
      response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.ceil(retryAfter)
        : undefined,
    );
  }
  return value;
}

function progressFromResponse(value: unknown): ServerAlphabetProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const progress = value as Record<string, unknown>;
  if (progress.kind !== "alphabet" || !Array.isArray(progress.letters)) return null;
  return progress as unknown as ServerAlphabetProgress;
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

export function useServerAlphabetSession({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerAlphabetChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const [phase, setPhase] = useState<ServerAlphabetPhase>(
    roomContext.result
      ? "results"
      : roomContext.attemptStatus === "inProgress"
        ? "recovering"
        : "intro",
  );
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [question, setQuestion] = useState<ServerAlphabetQuestion | null>(null);
  const [progress, setProgress] = useState<ServerAlphabetProgress | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(() => initialResults(roomContext));
  const resultsRef = useRef<AnswerResult[]>(results);
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [reviewChallenge, setReviewChallenge] = useState(() =>
    terminalReview?.length ? alphabetChallengeWithReview(challenge, terminalReview) : null,
  );
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [startNotice, setStartNotice] = useState<string>();
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const recoveryStarted = useRef(false);
  const recoveryInFlight = useRef(false);
  const commandInFlight = useRef(false);
  const timeoutGuard = useRef(createAlphabetTimeoutGuard());

  const replaceResults = (nextResults: AnswerResult[]) => {
    resultsRef.current = nextResults;
    setResults(nextResults);
  };

  const complete = async (currentAttempt: AttemptState, currentResults: AnswerResult[]) => {
    const response = await postJson(`/api/competitive/attempts/${currentAttempt.id}/complete`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: idempotencyKey("complete"),
    });
    const review = Array.isArray(response.review)
      ? (response.review as ServerFlashTerminalReview[])
      : [];
    setScore(
      Number(response.score ?? currentResults.reduce((sum, result) => sum + result.points, 0)),
    );
    setReviewChallenge(review.length ? alphabetChallengeWithReview(challenge, review) : null);
    setPhase("results");
    setQuestion(null);
    setProgress(null);
  };

  const prepare = async (currentAttempt: AttemptState): Promise<void> => {
    const response = await postJson(`/api/competitive/attempts/${currentAttempt.id}/prepare`, {
      lockVersion: currentAttempt.lockVersion,
      idempotencyKey: idempotencyKey("prepare"),
    });
    const nextAttempt = { id: currentAttempt.id, lockVersion: Number(response.lockVersion) };
    setAttempt(nextAttempt);
    const nextProgress = progressFromResponse(response.progress);
    setProgress(nextProgress);
    if (typeof response.deadlineAt === "string") setDeadlineAt(Date.parse(response.deadlineAt));
    if (response.timedOut === true && response.publicPayload === null) {
      const itemId = String(response.challengeItemId);
      const timeoutResponse = await postJson(
        `/api/competitive/attempts/${currentAttempt.id}/answer`,
        {
          lockVersion: nextAttempt.lockVersion,
          idempotencyKey: idempotencyKey(`timeout:${itemId}`),
          challengeItemId: itemId,
          answer: null,
        },
      );
      const result: AnswerResult = {
        questionId: itemId,
        answer: null,
        status: String(timeoutResponse.status) as AnswerResult["status"],
        isCorrect: false,
        points: Number(timeoutResponse.points ?? 0),
        timeUsed: Number(timeoutResponse.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...resultsRef.current, result];
      replaceResults(nextResults);
      setLastResult(result);
      const updatedAttempt = {
        id: currentAttempt.id,
        lockVersion: Number(timeoutResponse.lockVersion),
      };
      setAttempt(updatedAttempt);
      if (nextResults.length >= challenge.entries.length) {
        await complete(updatedAttempt, nextResults);
      } else {
        await prepare(updatedAttempt);
      }
      return;
    }
    const nextQuestion = questionFromAlphabetPayload(
      String(response.challengeItemId),
      challenge.entries.find((entry) => entry.id === String(response.challengeItemId))?.letter ??
        "",
      response.publicPayload,
      challenge.entries.find((entry) => entry.id === String(response.challengeItemId))
        ?.timeLimitMs ?? 1,
      challenge.entries.find((entry) => entry.id === String(response.challengeItemId))?.points ?? 0,
    );
    setQuestion(nextQuestion);
    setLocked(false);
    setPhase("playing");
  };

  const recover = async () => {
    if (recoveryInFlight.current) return;
    recoveryInFlight.current = true;
    setPhase("recovering");
    setLocked(true);
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
      setAttempt(currentAttempt);
      const response = await postJson(`/api/competitive/attempts/${currentAttempt.id}/recover`, {
        lockVersion: currentAttempt.lockVersion,
      });
      setAttempt({ id: currentAttempt.id, lockVersion: Number(response.lockVersion) });
      if (response.phase === "results") {
        setScore(Number(response.score ?? 0));
        const review = Array.isArray(response.review)
          ? (response.review as ServerFlashTerminalReview[])
          : [];
        setReviewChallenge(review.length ? alphabetChallengeWithReview(challenge, review) : null);
        setPhase("results");
        return;
      }
      await prepare({ id: currentAttempt.id, lockVersion: Number(response.lockVersion) });
    } catch (cause) {
      setStartNotice("No se ha podido recuperar la partida. Puedes reintentarlo.");
      throw cause;
    } finally {
      recoveryInFlight.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (roomContext.attemptStatus !== "inProgress" || recoveryStarted.current) return;
    recoveryStarted.current = true;
    void recover().catch(() => setStartNotice("No se ha podido recuperar la partida."));
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
    } catch (cause) {
      setStartNotice(
        rateLimitMessage(cause) ??
          (cause instanceof CompetitiveCommandError
            ? "No se ha podido iniciar el desafío."
            : "Error inesperado."),
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
    } catch (cause) {
      setLocked(true);
      setStartNotice(
        rateLimitMessage(cause) ??
          "No se ha podido preparar la primera letra. Puedes recuperar la partida.",
      );
      setPhase("recovering");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (answer: string | null) => {
    if (!attempt || !question || busy || commandInFlight.current) return;
    commandInFlight.current = true;
    setBusy(true);
    setLocked(true);
    setError(undefined);
    let answerAccepted = false;
    try {
      const response = await postJson(`/api/competitive/attempts/${attempt.id}/answer`, {
        lockVersion: attempt.lockVersion,
        idempotencyKey: idempotencyKey("alphabet-answer"),
        challengeItemId: question.id,
        answer,
      });
      answerAccepted = true;
      const result: AnswerResult = {
        questionId: question.id,
        answer,
        status: String(response.status) as AnswerResult["status"],
        isCorrect: response.status === "correct" || response.status === "partial",
        points: Number(response.points ?? 0),
        timeUsed: Number(response.timeUsedMs ?? 0) / 1000,
      };
      const nextResults = [...resultsRef.current, result];
      const nextAttempt = { id: attempt.id, lockVersion: Number(response.lockVersion) };
      replaceResults(nextResults);
      setLastResult(result);
      setAttempt(nextAttempt);
      if (nextResults.length >= challenge.entries.length) await complete(nextAttempt, nextResults);
      else await prepare(nextAttempt);
    } catch (cause) {
      if (answer === null) {
        setPhase("recovering");
        const rateLimitNotice = rateLimitMessage(cause);
        setStartNotice(rateLimitNotice ?? "Cerrando la partida tras agotarse el tiempo…");
        if (!rateLimitNotice) {
          try {
            await recover();
          } catch {
            // recover leaves the player on a blocked recovery screen with a manual retry.
          }
        }
      } else {
        if (answerAccepted) {
          setPhase("recovering");
          setStartNotice(
            rateLimitMessage(cause) ??
              "No se ha podido preparar el siguiente estado. Puedes recuperar la partida.",
          );
        } else {
          setError(rateLimitMessage(cause) ?? "No se ha podido confirmar la respuesta.");
          setLocked(false);
        }
      }
    } finally {
      commandInFlight.current = false;
      setBusy(false);
    }
  };

  const pass = async () => {
    if (!attempt || !question || busy || commandInFlight.current) return;
    commandInFlight.current = true;
    setBusy(true);
    setLocked(true);
    setError(undefined);
    let passAccepted = false;
    try {
      const response = await postJson(`/api/competitive/attempts/${attempt.id}/alphabet/pass`, {
        lockVersion: attempt.lockVersion,
        idempotencyKey: idempotencyKey("alphabet-pass"),
        challengeItemId: question.id,
      });
      passAccepted = true;
      await prepare({ id: attempt.id, lockVersion: Number(response.lockVersion) });
    } catch (cause) {
      if (passAccepted) {
        setPhase("recovering");
        setStartNotice(
          rateLimitMessage(cause) ??
            "No se ha podido preparar la siguiente letra. Puedes recuperar la partida.",
        );
      } else {
        setError(rateLimitMessage(cause) ?? "No se ha podido pasar la letra.");
        setLocked(false);
      }
    } finally {
      commandInFlight.current = false;
      setBusy(false);
    }
  };

  const onTimeUp = () => {
    if (!question || commandInFlight.current || !timeoutGuard.current.claim()) return;
    void submit(null);
  };

  const retryRecovery = () => {
    void recover().catch(() => undefined);
  };

  return {
    phase,
    question,
    progress,
    results,
    lastResult,
    score,
    reviewChallenge,
    locked,
    busy,
    error,
    startNotice,
    deadlineAt,
    begin,
    startQuestions,
    submit,
    pass,
    retryRecovery,
    showReview: () => setPhase("review"),
    showResults: () => setPhase("results"),
    onTimeUp,
  };
}
