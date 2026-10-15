"use client";

import { createPracticeInput } from "@/features/question-formats/createPracticeInput";
import type { PracticeInput } from "@/features/question-formats/practiceInputTypes";
import { withPracticeTimedResponseStart } from "@/features/question-formats/withPracticeTimedResponseStart";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { Canvas, GameHeader, Timer } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { useNarrativeSession } from "@/features/narrative/useNarrativeSession";
import type { NarrativeSessionState } from "@/features/narrative/narrativeSession";
import {
  useRoomAttemptResume,
  useRoomAttemptSnapshot,
} from "@/features/rooms/useRoomAttemptSnapshot";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { sumEffectiveDurationMs } from "@/lib/challengeRanking";
import { CHALLENGE_MAX_SCORE } from "@/lib/challengeScoring";
import {
  NarrativeSceneScreen,
  NarrativeEpilogueScreen,
  NarrativeResult,
  PolarBackground,
} from "./NarrativePresentation";
import styles from "./NarrativeGame.module.css";
import type { ChallengeCompletionResult, NarrativeChallenge } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";

function NarrativeIntro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: NarrativeChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

function NarrativeQuestionScreen({
  input,
  questionNumber,
  totalQuestions,
  onTimeUp,
}: {
  input: PracticeInput;
  questionNumber: number;
  totalQuestions: number;
  onTimeUp: () => void;
}) {
  const { question, locked } = input.props;
  const onTimedResponseStart =
    "onTimedResponseStart" in input.props ? input.props.onTimedResponseStart : undefined;
  const hasDelayedStart = question.type === "progressive-image";
  const [timedResponseStarted, setTimedResponseStarted] = useState(!hasDelayedStart);
  const startTimedResponse = () => {
    setTimedResponseStarted(true);
    onTimedResponseStart?.();
  };

  return (
    <motion.section
      className={styles.storyScreen}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
    >
      <GameHeader
        className={styles.questionHud}
        left={
          <p className={styles.questionIndicator}>
            Prueba {String(questionNumber).padStart(2, "0")}{" "}
            <span>de {String(totalQuestions).padStart(2, "0")}</span>
          </p>
        }
        timer={
          !hasDelayedStart || timedResponseStarted ? (
            <Timer
              duration={question.timeLimit}
              active={!locked && timedResponseStarted}
              onTimeUp={onTimeUp}
              resetKey={question.id}
              size="compact"
            />
          ) : null
        }
      />
      <section className={styles.questionPage}>
        <article className={styles.questionArticle}>
          <h1>{question.question}</h1>
          {question.questionContext && (
            <p className={styles.questionContext}>{question.questionContext}</p>
          )}
          {"media" in question && question.media && (
            <div className={styles.questionMedia}>
              <QuestionMedia media={question.media} prominent />
            </div>
          )}
          <QuestionInput input={withPracticeTimedResponseStart(input, startTimedResponse)} />
        </article>
      </section>
    </motion.section>
  );
}

export function NarrativeGameApp({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: NarrativeChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const resumeState = useRoomAttemptResume<NarrativeSessionState>(
    roomContext,
    challenge.id,
    "narrative",
  );
  const session = useNarrativeSession(challenge, { resumeState });
  useRoomAttemptSnapshot(roomContext, challenge.id, "narrative", session.phase, session.snapshot);
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
  const input = createPracticeInput({
    question: session.currentStep?.type === "question" ? session.currentStep.question : null,
    locked: session.locked,
    onSubmit: session.submitAnswer,
    onProgress: session.handleAnswerProgress,
    onIncorrectAttempt: session.handleIncorrectAttempt,
    onTimedResponseStart: session.handleTimedResponseStart,
    onProgressiveClueReveal: () => undefined,
    onCodeAttempt: () => false,
    codeAttemptCount: 0,
  });
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
  const narrativeFeedbackStatus = session.lastTimedOut
    ? "unanswered"
    : (session.results.at(-1)?.status ?? "incorrect");
  const narrativeFeedbackCopy = getFlashPopFeedbackCopy({
    status: narrativeFeedbackStatus,
    timedOut: session.lastTimedOut,
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
            <AnimatePresence mode="wait">
              {session.phase === "intro" && (
                <NarrativeIntro
                  key="narrative-intro"
                  challenge={challenge}
                  onStart={session.start}
                  returnTo={roomContext?.returnTo}
                />
              )}
              {session.phase === "scene" &&
                session.currentStep?.type === "scene" &&
                (isBlackoutScene ? (
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
                ))}
              {session.phase === "playing" && session.currentStep?.type === "question" && input && (
                <NarrativeQuestionScreen
                  key={session.currentStep.question.id}
                  input={input}
                  questionNumber={session.questionNumber}
                  totalQuestions={session.totalQuestions}
                  onTimeUp={session.handleTimeUp}
                />
              )}
              {session.phase === "transition" && (
                <motion.div
                  className={styles.feedbackStage}
                  key={`feedback-${session.stepIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FlashPopFeedback
                    status={narrativeFeedbackStatus}
                    title={narrativeFeedbackCopy.title}
                    body={narrativeFeedbackCopy.body}
                    points={
                      narrativeFeedbackStatus === "correct" || narrativeFeedbackStatus === "partial"
                        ? session.results.at(-1)?.points
                        : undefined
                    }
                  />
                </motion.div>
              )}
              {session.phase === "results" && (
                <NarrativeResult
                  key="narrative-results"
                  results={session.results}
                  score={session.score}
                  maxScore={CHALLENGE_MAX_SCORE}
                  onReview={session.showReview}
                  returnTo={roomContext?.returnTo ?? "/"}
                />
              )}
              {session.phase === "review" && (
                <ReviewAnswers
                  key="narrative-review"
                  challenge={challenge}
                  results={session.results}
                  onBack={session.showResults}
                  onReplay={roomContext ? undefined : session.replay}
                />
              )}
            </AnimatePresence>
          </div>
        </Canvas>
      </main>
    </MotionConfig>
  );
}
