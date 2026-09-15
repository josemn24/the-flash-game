"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  buildResultModel,
  QuestionStage,
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopFlashGame.client";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ChallengeResultScreen, StartCountdown } from "@/components/game/shared";
import { Button, Card } from "@/components/ui";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import type {
  AnswerResult,
  AnswerValue,
  FlashChallenge,
  GameRoomContext,
  Question,
} from "@/types/game";
import type { ServerFlashChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import styles from "./FlashPopFlashGame.module.css";

type Phase = "intro" | "recovering" | "countdown" | "playing" | "transition" | "results" | "review";

type TerminalReviewResponseRow = {
  challenge_item_id: string;
  public_payload: unknown;
  solution_payload: unknown;
};

class CompetitiveCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function questionFromPayload(
  id: string,
  payload: unknown,
  timeLimitMs: number,
  points: number,
): Question {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_question_payload");
  }
  const value = payload as Record<string, unknown>;
  const prompt = value.question ?? value.prompt;
  if (
    typeof prompt !== "string" ||
    !Array.isArray(value.options) ||
    !value.options.every((x) => typeof x === "string")
  ) {
    throw new Error("invalid_question_payload");
  }
  return {
    id,
    type: "multiple-choice",
    category: typeof value.category === "string" ? value.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: prompt,
    options: value.options,
    timeLimit: timeLimitMs / 1000,
    points,
    explanation: "",
  } as unknown as Question;
}

function questionWithSolution(question: Question, row?: ServerFlashTerminalReview): Question {
  if (!row || !row.solutionPayload || typeof row.solutionPayload !== "object") return question;
  const solution = row.solutionPayload as Record<string, unknown>;
  return {
    ...question,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : {}),
    ...(typeof solution.explanation === "string" ? { explanation: solution.explanation } : {}),
  } as Question;
}

function challengeWithReview(
  challenge: ServerFlashChallenge,
  review: readonly ServerFlashTerminalReview[],
) {
  return {
    ...challenge,
    questions: challenge.slots.map((slot) => {
      const row = review.find((item) => item.challengeItemId === slot.id);
      return questionWithSolution(
        questionFromPayload(slot.id, row?.publicPayload, slot.timeLimitMs, slot.points),
        row,
      );
    }),
  } as FlashChallenge;
}

function isTerminalReviewResponseRow(value: unknown): value is TerminalReviewResponseRow {
  if (!value || typeof value !== "object") return false;
  return "challenge_item_id" in value && "solution_payload" in value && "public_payload" in value;
}

function terminalReviewFromResponse(value: unknown): ServerFlashTerminalReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTerminalReviewResponseRow).map((row) => ({
    challengeItemId: row.challenge_item_id,
    publicPayload: row.public_payload,
    solutionPayload: row.solution_payload,
  }));
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

export function ServerFlashPopGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerFlashChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const router = useRouter();
  const initialResult: AnswerResult[] = (roomContext.result?.attempt?.answers ?? []).map(
    (answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
      status: answer.status,
      isCorrect: answer.isCorrect,
      points: answer.points ?? 0,
      timeUsed: answer.timeUsed ?? 0,
      ...(answer.details ? { details: answer.details } : {}),
    }),
  );
  const [phase, setPhase] = useState<Phase>(
    roomContext.result
      ? "results"
      : roomContext.attemptStatus === "inProgress"
        ? "recovering"
        : "intro",
  );
  const [attempt, setAttempt] = useState<{ id: string; lockVersion: number } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(initialResult);
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
  const displayChallenge = useMemo(
    () =>
      ({
        ...challenge,
        questions: challenge.slots.map((slot) => ({
          id: slot.id,
          type: "multiple-choice" as const,
          category: "",
          tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
          question: "",
          options: [],
          timeLimit: slot.timeLimitMs / 1000,
          points: slot.points,
          explanation: "",
        })) as unknown as Question[],
      }) as FlashChallenge,
    [challenge],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const prepare = async (currentAttempt: { id: string; lockVersion: number }) => {
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
    const currentAttempt = {
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
    // Recovery is single-shot per mounted controller session; the ref also
    // protects this action from React Strict Mode effect replay in development.
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
      const nextAttempt = {
        id: String(started.attemptId),
        lockVersion: Number(started.lockVersion),
      };
      setAttempt(nextAttempt);
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
            const terminalReview = terminalReviewFromResponse(completed.review);
            setScore(Number(completed.score ?? 0));
            setReviewChallenge(challengeWithReview(challenge, terminalReview));
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
    if (!attempt || busy || !window.confirm("¿Abandonar este intento? No podrás retomarlo."))
      return;
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

  return (
    <MotionConfig reducedMotion="user">
      <div data-gameplay-persistence="server">
        <AnimatePresence mode="wait">
          {phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChallengeIntro
                introduction={{
                  title: challenge.title,
                  mode: "flash",
                  questionCount: challenge.slots.length,
                  maxScore: challenge.maxScore,
                }}
                onStart={begin}
                canStart
                notice={startNotice}
                returnTo={roomContext.returnTo}
              />
            </motion.div>
          ) : null}
          {phase === "recovering" ? (
            <Card
              key="recovering"
              role="status"
              aria-live="polite"
              className="mx-auto mt-12 max-w-xl"
            >
              <h1>Recuperando partida</h1>
              <p className="mt-2">Comprobamos de forma segura el último estado de tu intento.</p>
            </Card>
          ) : null}
          {phase === "countdown" ? (
            <StartCountdown label="Flash clásico" key="countdown" onComplete={startQuestions} />
          ) : null}
          {phase === "playing" && question ? (
            <motion.div
              className={styles.stageFrame}
              key={question.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <QuestionStage
                challenge={displayChallenge}
                question={question}
                questionIndex={questionIndex}
                locked={locked}
                onSubmit={submit}
                onTimeUp={() => void submit(null)}
                onProgress={() => undefined}
                onIncorrectAttempt={() => undefined}
                onProgressiveClueReveal={() => undefined}
                onCodeAttempt={() => false}
                onTimedResponseStart={() => undefined}
                attemptCount={0}
              />
            </motion.div>
          ) : null}
          {phase === "transition" ? (
            <motion.div
              key={`transition-${questionIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Transition
                result={lastResult}
                timedOut={lastResult?.status === "unanswered"}
                isLast={questionIndex === challenge.slots.length - 1}
              />
            </motion.div>
          ) : null}
          {phase === "results" ? (
            <motion.div
              className={styles.stageFrame}
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChallengeResultScreen
                model={buildResultModel(results, score)}
                onReview={() => reviewChallenge && setPhase("review")}
                returnTo={roomContext.returnTo}
              />
            </motion.div>
          ) : null}
          {phase === "review" && reviewChallenge ? (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ReviewStage
                challenge={reviewChallenge}
                results={results}
                onBack={() => setPhase("results")}
                returnTo={roomContext.returnTo}
                roomContext={roomContext}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        {attempt && (phase === "countdown" || phase === "playing" || phase === "transition") ? (
          <div className="mx-auto mt-4 flex max-w-xl justify-end">
            <Button variant="secondary" onClick={() => void abandon()} disabled={busy}>
              Abandonar intento
            </Button>
          </div>
        ) : null}
      </div>
    </MotionConfig>
  );
}
