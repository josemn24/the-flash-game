"use client";

import { motion } from "motion/react";
import {
  buildResultModel,
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopFlashGame.client";
import { FlashPopGameShell } from "@/components/game/modes/flash-pop/FlashPopGameShell";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import {
  ChallengeResultScreen,
  FlashQuestionStage,
  StartCountdown,
} from "@/components/game/shared";
import { Card } from "@/components/ui";
import { useServerFlashSession } from "@/features/game/useServerFlashSession";
import type { GameRoomContext } from "@/types/game";
import type { ServerFlashChallenge, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import styles from "./FlashPopFlashGame.module.css";

export function ServerFlashPopGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerFlashChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerFlashSession({ challenge, roomContext, terminalReview });

  return (
    <FlashPopGameShell layout={session.phase === "intro" ? "intro" : "game"}>
      {session.phase === "intro" ? (
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
            onStart={session.begin}
            canStart
            notice={session.startNotice}
            returnTo={roomContext.returnTo}
          />
        </motion.div>
      ) : null}
      {session.phase === "recovering" ? (
        <Card key="recovering" role="status" aria-live="polite" className="mx-auto mt-12 max-w-xl">
          <h1>Recuperando partida</h1>
          <p className="mt-2">Comprobamos de forma segura el último estado de tu intento.</p>
        </Card>
      ) : null}
      {session.phase === "countdown" ? (
        <StartCountdown label="Flash clásico" key="countdown" onComplete={session.startQuestions} />
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
            totalQuestions={challenge.slots.length}
            locked={session.locked}
            pendingAnswer={session.pendingAnswer}
            submissionState={session.submissionState}
            submissionStatusVisible={session.submissionStatusVisible}
            submissionError={session.submissionError}
            onRetrySubmission={session.retrySubmit}
            codeAttemptCount={0}
            onSubmit={session.submit}
            onTimeUp={() => void session.submit(null)}
            onProgress={() => undefined}
            onIncorrectAttempt={() => undefined}
            onProgressiveClueReveal={() => undefined}
            onCodeAttempt={() => false}
            onTimedResponseStart={() => undefined}
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
            result={session.lastResult}
            timedOut={session.lastResult?.status === "unanswered"}
            isLast={session.questionIndex === challenge.slots.length - 1}
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
            onReview={() => session.reviewChallenge && session.showReview()}
            returnTo={roomContext.returnTo}
          />
        </motion.div>
      ) : null}
      {session.phase === "review" && session.reviewChallenge ? (
        <motion.div
          key="review"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ReviewStage
            challenge={session.reviewChallenge}
            results={session.results}
            onBack={session.showResults}
            returnTo={roomContext.returnTo}
            roomContext={roomContext}
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
