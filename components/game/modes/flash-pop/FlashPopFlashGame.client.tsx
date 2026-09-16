"use client";

import { useMemo } from "react";
import { motion, MotionConfig } from "motion/react";
import { CheckIcon, ClockIcon, CrossIcon } from "@/components/ui";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ButtonLink, Card, Canvas, GameHeader } from "@/components/ui";
import {
  ChallengeResultScreen,
  FlashQuestionStage,
  ReviewAnswerPanel,
  StartCountdown,
  type ChallengeResultModel,
} from "@/components/game/shared";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { useGameSession, type GameSessionSnapshot } from "@/features/game/useGameSession";
import {
  useRoomAttemptResume,
  useRoomAttemptSnapshot,
} from "@/features/rooms/useRoomAttemptSnapshot";
import { FLASH_POP_FEEDBACK_DURATION } from "@/features/game/transitionTiming";
import { FLASH_POP_FLASH_PILOT_ID } from "@/features/flash-pop/demoSocial";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { sumEffectiveDurationMs } from "@/lib/challengeRanking";
import { CHALLENGE_MAX_SCORE, withChallengeScoring } from "@/lib/challengeScoring";
import { FlashPopGameShell } from "./FlashPopGameShell";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import type {
  AnswerResult,
  ChallengeCompletionResult,
  FlashChallenge,
  GameRoomContext,
} from "@/types/game";
import styles from "./FlashPopFlashGame.module.css";

function Intro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: FlashChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

export function Transition({
  result,
  timedOut,
  isLast,
}: {
  result?: AnswerResult;
  timedOut: boolean;
  isLast: boolean;
}) {
  const status = result?.status ?? (timedOut ? "unanswered" : "incorrect");
  const { title, body } = getFlashPopFeedbackCopy({ status, timedOut, isLast });

  return (
    <FlashPopFeedback
      status={status}
      title={title}
      body={body}
      points={status === "correct" || status === "partial" ? result?.points : undefined}
    />
  );
}

export function buildResultModel(results: AnswerResult[], score: number): ChallengeResultModel {
  const correct = results.filter((result) => result.status === "correct").length;
  const incorrect = results.filter((result) => result.status === "incorrect").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const message =
    accuracy >= 80 ? "Sprint brutal." : accuracy >= 50 ? "Buen ritmo." : "Desafío duro.";

  return {
    gameTitle: "Flash clásico",
    statusLabel: "Completado",
    eyebrow: "Desafío completado",
    title: message,
    score,
    maxScore: CHALLENGE_MAX_SCORE,
    scoreUnit: "flashPoints",
    accuracy,
    totalTime,
    metrics: [
      { icon: <CheckIcon />, label: "Correctas", value: correct, tone: "success" },
      { icon: <CrossIcon />, label: "Falladas", value: incorrect, tone: "danger" },
      { icon: <ClockIcon />, label: "Sin contestar", value: unanswered },
    ],
  };
}

export function ReviewStage({
  challenge,
  results,
  onBack,
  onReplay,
  returnTo,
  roomContext,
}: {
  challenge: FlashChallenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay?: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
}) {
  const resultByQuestionId = new Map(results.map((result) => [result.questionId, result]));
  const entries = challenge.questions.map((question, index) => ({
    id: question.id,
    question,
    result: resultByQuestionId.get(question.id),
    marker: String(index + 1).padStart(2, "0"),
  }));

  return (
    <div className={styles.stage}>
      <GameHeader
        title="Revisión"
        action={
          <ButtonLink href={returnTo} variant="secondary">
            {roomContext ? "Tabarnia" : "Lobby"}
          </ButtonLink>
        }
      />
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${results.length} respuestas`}
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada desafío."
        onBack={onBack}
        onReplay={onReplay}
      />
    </div>
  );
}

export function FlashPopFlashGame({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: FlashChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const resumeState = useRoomAttemptResume<GameSessionSnapshot>(roomContext, challenge.id, "flash");
  const session = useGameSession(scoredChallenge, {
    transitionDuration: FLASH_POP_FEEDBACK_DURATION,
    resumeState,
  });
  useRoomAttemptSnapshot(roomContext, challenge.id, "flash", session.phase, session.snapshot);
  const lastResult = session.results[session.results.length - 1];

  useChallengeCompletionReporter(
    session.phase === "results"
      ? {
          challengeId: challenge.id,
          startedAt:
            session.startedAt ??
            roomContext?.result?.attempt?.startedAt ??
            new Date().toISOString(),
          flashPoints: session.score,
          completed: true,
          durationMs: sumEffectiveDurationMs(session.results),
          answers: session.results,
        }
      : null,
    onComplete,
  );

  if (challenge.id !== FLASH_POP_FLASH_PILOT_ID) {
    return (
      <MotionConfig reducedMotion="user">
        <Canvas maxWidth="content">
          <Card>
            <h1>Preview no disponible</h1>
            <p>Este piloto está limitado a tabarnia-flash-01.</p>
            <ButtonLink href={roomContext?.returnTo ?? "/flash-pop"}>&quot;Volver&quot;</ButtonLink>
          </Card>
        </Canvas>
      </MotionConfig>
    );
  }

  return (
    <FlashPopGameShell layout={session.phase === "intro" ? "intro" : "game"}>
      {session.phase === "intro" ? (
        <motion.div
          key="intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Intro
            challenge={scoredChallenge}
            onStart={session.beginCountdown}
            returnTo={roomContext?.returnTo}
          />
        </motion.div>
      ) : null}
      {session.phase === "countdown" ? (
        <StartCountdown label="Flash clásico" key="countdown" onComplete={session.start} />
      ) : null}
      {session.phase === "playing" && session.question ? (
        <motion.div
          className={styles.stageFrame}
          key={session.question.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
        >
          <FlashQuestionStage
            question={session.question}
            questionNumber={session.questionIndex + 1}
            totalQuestions={scoredChallenge.questions.length}
            locked={session.locked}
            codeAttemptCount={session.codeAttempts.length}
            onSubmit={session.submitAnswer}
            onTimeUp={session.handleTimeUp}
            onProgress={session.handleAnswerProgress}
            onIncorrectAttempt={session.handleIncorrectAttempt}
            onProgressiveClueReveal={session.handleProgressiveClueReveal}
            onCodeAttempt={session.handleCodeAttempt}
            onTimedResponseStart={session.handleTimedResponseStart}
          />
        </motion.div>
      ) : null}
      {session.phase === "transition" ? (
        <motion.div
          key={`transition-${session.questionIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Transition
            result={lastResult}
            timedOut={session.lastTimedOut}
            isLast={session.questionIndex === scoredChallenge.questions.length - 1}
          />
        </motion.div>
      ) : null}
      {session.phase === "results" ? (
        <motion.div
          className={styles.stageFrame}
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ChallengeResultScreen
            model={buildResultModel(session.results, session.score)}
            onReview={session.showReview}
            returnTo={roomContext?.returnTo ?? "/flash-pop"}
          />
        </motion.div>
      ) : null}
      {session.phase === "review" ? (
        <motion.div
          key="review"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ReviewStage
            challenge={scoredChallenge}
            results={session.results}
            onBack={session.showResults}
            onReplay={roomContext ? undefined : session.replay}
            returnTo={roomContext?.returnTo ?? "/flash-pop"}
            roomContext={roomContext}
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
