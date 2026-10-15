"use client";

import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Canvas, Card } from "@/components/ui";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ServerFlashQuestionStage } from "@/components/game/shared";
import { AnswerFeedbackStage } from "@/components/game/modes/flash-pop/AnswerFeedbackStage";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ReviewStage } from "@/components/game/modes/flash-pop/FlashPopCompetitiveHelpers";
import { useServerNarrativeSession } from "@/features/game/useServerNarrativeSession";
import type { ServerFlashTerminalReview, ServerNarrativeChallenge } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import {
  NarrativeSceneScreen,
  NarrativeEpilogueScreen,
  NarrativeResult,
  PolarBackground,
} from "./NarrativePresentation";
import styles from "./NarrativeGame.module.css";

export function ServerNarrativeGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerNarrativeChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerNarrativeSession({ challenge, roomContext, terminalReview });
  const pageCount = 1 + challenge.beats.reduce((total, beat) => total + beat.steps.length, 0);
  const isBlackoutScene =
    session.phase === "scene" &&
    session.currentStep?.type === "scene" &&
    session.currentStep.scene.presentation === "blackout";
  const isDarkStoryScene =
    session.phase === "scene" &&
    session.currentStep?.type === "scene" &&
    (session.currentStep.scene.presentation === "chapter-opening" ||
      session.currentStep.scene.presentation === "full-bleed");
  const feedbackStatus = session.lastResult?.status ?? "incorrect";
  const feedbackCopy = getFlashPopFeedbackCopy({
    status: session.lastResult?.status ?? "incorrect",
    timedOut: session.lastResult?.status === "unanswered",
    nextLabel: "escena",
  });

  return (
    <MotionConfig reducedMotion="user">
      <main
        data-mode="narrative"
        className={`${styles.gameRoot} ${session.phase === "playing" ? styles.questionPhase : ""} ${isBlackoutScene ? styles.blackoutPhase : ""} ${isDarkStoryScene ? styles.darkStoryPhase : ""}`}
      >
        <PolarBackground />
        <Canvas
          as="div"
          maxWidth="none"
          className={styles.flashPopCanvas}
          contentClassName={styles.flashPopCanvasContent}
        >
          <div className={styles.gameContent}>
            <CompetitiveLifecycleNotice
              error={session.lifecycleError}
              busy={session.busy}
              onRetry={session.retryLifecycle}
            />
            <AnimatePresence mode="wait">
              {session.phase === "intro" ? (
                <motion.div key="narrative-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ChallengeIntro
                    introduction={{
                      title: challenge.title,
                      mode: "narrative",
                      questionCount: challenge.slots.length,
                      maxScore: challenge.maxScore,
                    }}
                    onStart={session.begin}
                    canStart
                    notice={session.startNotice}
                    transfer={
                      session.transfer
                        ? {
                            busy: session.busy,
                            onConfirm: session.takeOver,
                            onCancel: session.cancelTakeOver,
                          }
                        : undefined
                    }
                    returnTo={roomContext.returnTo}
                  />
                </motion.div>
              ) : null}
              {session.phase === "recovering" ? (
                <Card
                  key="recovering"
                  role="status"
                  aria-live="polite"
                  className="mx-auto mt-12 max-w-xl"
                >
                  <h1>Recuperando partida</h1>
                  <p className="mt-2">
                    Comprobamos de forma segura el último estado de tu intento.
                  </p>
                </Card>
              ) : null}
              {session.phase === "scene" && session.currentStep?.type === "scene" ? (
                session.currentStep.scene.presentation === "blackout" ? (
                  <NarrativeEpilogueScreen
                    key={session.currentStep.scene.id}
                    onContinue={session.continueScene}
                  />
                ) : (
                  <NarrativeSceneScreen
                    key={session.currentStep.scene.id}
                    scene={session.currentStep.scene}
                    pageNumber={session.stepIndex + 1}
                    pageCount={pageCount}
                    onContinue={session.continueScene}
                  />
                )
              ) : null}
              {session.phase === "preparing" ? (
                <Card
                  key="preparing"
                  role="status"
                  aria-live="polite"
                  className="mx-auto mt-12 max-w-xl"
                >
                  <h1>Preparando la siguiente prueba</h1>
                  <p className="mt-2">La pregunta se libera ahora desde el servidor.</p>
                </Card>
              ) : null}
              {session.phase === "playing" && session.question && session.questionInput ? (
                <motion.div
                  key={session.question.id}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                >
                  <ServerFlashQuestionStage
                    input={session.questionInput}
                    questionNumber={session.questionNumber}
                    totalQuestions={challenge.slots.length}
                    deadlineAt={session.questionDeadlineAt}
                    onTimeUp={session.handleTimeUp}
                  />
                </motion.div>
              ) : null}
              {session.phase === "checking" ? (
                <AnswerFeedbackStage
                  key="narrative-checking"
                  {...(session.submissionState === "error"
                    ? {
                        state: "error" as const,
                        errorMessage:
                          session.submissionError ?? "No hemos podido confirmar tu respuesta.",
                        onRetry: session.retrySubmit,
                      }
                    : {
                        state: "checking" as const,
                        indicatorVisible: session.submissionStatusVisible,
                      })}
                />
              ) : null}
              {session.phase === "transition" ? (
                <motion.div
                  className={styles.feedbackStage}
                  key={`feedback-${session.stepIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FlashPopFeedback
                    status={feedbackStatus}
                    title={feedbackCopy.title}
                    body={feedbackCopy.body}
                    points={
                      feedbackStatus === "correct" || feedbackStatus === "partial"
                        ? session.lastResult?.points
                        : undefined
                    }
                  />
                </motion.div>
              ) : null}
              {session.phase === "results" ? (
                <motion.div
                  key="narrative-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <NarrativeResult
                    results={session.results}
                    score={session.score}
                    maxScore={challenge.maxScore}
                    onReview={session.reviewChallenge ? session.showReview : undefined}
                    returnTo={roomContext.returnTo}
                    expired={session.attemptExpired}
                  />
                </motion.div>
              ) : null}
              {session.phase === "review" && session.reviewChallenge ? (
                <motion.div
                  key="narrative-review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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
            </AnimatePresence>
          </div>
        </Canvas>
      </main>
    </MotionConfig>
  );
}
