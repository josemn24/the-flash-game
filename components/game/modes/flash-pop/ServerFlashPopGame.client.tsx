"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  buildResultModel,
  QuestionStage,
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopFlashGame.client";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ChallengeResultScreen, StartCountdown } from "@/components/game/shared";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import type {
  AnswerResult,
  AnswerValue,
  FlashChallenge,
  GameRoomContext,
  Question,
} from "@/types/game";
import styles from "./FlashPopFlashGame.module.css";

type Phase = "intro" | "countdown" | "playing" | "transition" | "results" | "review";

type TerminalReviewRow = {
  challenge_item_id: string;
  solution_payload: unknown;
};

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function questionWithSolution(question: Question, row?: TerminalReviewRow): Question {
  if (!row || !row.solution_payload || typeof row.solution_payload !== "object") return question;
  const solution = row.solution_payload as Record<string, unknown>;
  return {
    ...question,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : {}),
    ...(typeof solution.explanation === "string" ? { explanation: solution.explanation } : {}),
  } as Question;
}

function challengeWithReview(challenge: FlashChallenge, review: TerminalReviewRow[]) {
  return {
    ...challenge,
    questions: challenge.questions.map((question) =>
      questionWithSolution(
        question,
        review.find((row) => row.challenge_item_id === question.id),
      ),
    ),
  } as FlashChallenge;
}

function isTerminalReviewRow(value: unknown): value is TerminalReviewRow {
  if (!value || typeof value !== "object") return false;
  return "challenge_item_id" in value && "solution_payload" in value;
}

async function postJson(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error("competitive_command_failed");
  return value;
}

export function ServerFlashPopGame({
  challenge,
  roomContext,
}: {
  challenge: FlashChallenge;
  roomContext: GameRoomContext;
}) {
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
  const [phase, setPhase] = useState<Phase>(roomContext.result ? "results" : "intro");
  const [attempt, setAttempt] = useState<{ id: string; lockVersion: number } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<AnswerResult[]>(initialResult);
  const [lastResult, setLastResult] = useState<AnswerResult>();
  const [score, setScore] = useState(roomContext.result?.flashPoints ?? 0);
  const [reviewChallenge, setReviewChallenge] = useState<FlashChallenge>(challenge);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    const nextIndex = challenge.questions.findIndex((item) => item.id === itemId);
    if (nextIndex < 0) throw new Error("competitive_question_not_found");
    setAttempt({ id: currentAttempt.id, lockVersion: nextLockVersion });
    setQuestionIndex(nextIndex);
    setQuestion(challenge.questions[nextIndex] ?? null);
    setLocked(Boolean(prepared.timedOut));
    setPhase("playing");
  };

  const begin = async () => {
    if (busy) return;
    setBusy(true);
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
          if (questionIndex === challenge.questions.length - 1) {
            const completed = await postJson(`/api/competitive/attempts/${attempt.id}/complete`, {
              lockVersion: nextLockVersion,
              idempotencyKey: idempotencyKey("complete"),
            });
            const terminalReview = Array.isArray(completed.review)
              ? completed.review.filter(isTerminalReviewRow)
              : [];
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
                challenge={challenge}
                onStart={begin}
                returnTo={roomContext.returnTo}
              />
            </motion.div>
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
                challenge={challenge}
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
                isLast={questionIndex === challenge.questions.length - 1}
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
                onReview={() => setPhase("review")}
                returnTo={roomContext.returnTo}
              />
            </motion.div>
          ) : null}
          {phase === "review" ? (
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
      </div>
    </MotionConfig>
  );
}
