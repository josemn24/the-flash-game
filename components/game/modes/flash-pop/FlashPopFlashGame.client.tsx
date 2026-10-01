"use client";

import { useMemo } from "react";
import { motion, MotionConfig } from "motion/react";
import { ButtonLink, Card, Canvas } from "@/components/ui";
import {
  FlashQuestionStage,
  StartCountdown,
  ChallengeResultScreen,
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
import { withChallengeScoring } from "@/lib/challengeScoring";
import { FlashPopGameShell } from "./FlashPopGameShell";
import type { ChallengeCompletionResult, FlashChallenge } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import styles from "./FlashPopFlashGame.module.css";
export { buildResultModel, ReviewStage, Transition } from "./FlashPopCompetitiveHelpers";
import { buildResultModel, ReviewStage, Transition } from "./FlashPopCompetitiveHelpers";

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
            <ButtonLink href={roomContext?.returnTo ?? "/demo/flash-pop"}>
              &quot;Volver&quot;
            </ButtonLink>
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
        <StartCountdown label="Flash" key="countdown" onComplete={session.start} />
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
            returnTo={roomContext?.returnTo ?? "/demo/flash-pop"}
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
            returnTo={roomContext?.returnTo ?? "/demo/flash-pop"}
            roomContext={roomContext}
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
