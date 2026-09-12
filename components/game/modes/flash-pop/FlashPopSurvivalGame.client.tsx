"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Canvas } from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ChallengeIntro, StartCountdown } from "@/components/game/shared";
import { QuestionScreen } from "@/components/game/shared/QuestionScreen";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";
import { useSurvivalSession } from "@/features/game/useSurvivalSession";
import {
  getFlashPopSurvivalResult,
  type FlashPopSurvivalSummary,
} from "@/features/flash-pop/survivalSocial";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import { withChallengeScoring } from "@/lib/challengeScoring";
import type {
  AnswerResult,
  ChallengeCompletionResult,
  GameRoomContext,
  SurvivalChallenge,
} from "@/types/game";
import { FlashPopSurvivalResult } from "./FlashPopSurvivalResult";
import styles from "./FlashPopSurvivalGame.module.css";

function totalTimeLimit(challenge: SurvivalChallenge) {
  return challenge.questions.reduce((total, question) => total + question.timeLimit, 0);
}

function Intro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: SurvivalChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

function Feedback({
  result,
  questionNumber,
  totalQuestions,
  livesRemaining,
  eliminated,
  survived,
}: {
  result: AnswerResult;
  questionNumber: number;
  totalQuestions: number;
  livesRemaining: number;
  eliminated: boolean;
  survived: boolean;
}) {
  const failure = result.status === "incorrect" || result.status === "unanswered";
  const title = eliminated
    ? "Sin vidas"
    : survived
      ? "Has sobrevivido"
      : result.status === "correct"
        ? "Respuesta correcta"
        : result.status === "partial"
          ? "Aproximación válida"
          : result.status === "unanswered"
            ? "Tiempo agotado"
            : "Casi.";
  const body = eliminated
    ? `Has llegado al reto ${questionNumber} de ${totalQuestions}.`
    : survived
      ? "Calculando tu resultado…"
      : failure
        ? `Pierdes una vida. Te quedan ${livesRemaining}.`
        : result.status === "partial"
          ? `Sumas puntos y conservas tus ${livesRemaining} vidas.`
          : "Siguiente reto en marcha.";

  return (
    <FlashPopFeedback
      status={result.status}
      title={title}
      body={body}
      points={result.points > 0 ? result.points : undefined}
    />
  );
}

function toSummary(
  challenge: SurvivalChallenge,
  session: ReturnType<typeof useSurvivalSession>,
): FlashPopSurvivalSummary {
  return {
    challengeId: challenge.id,
    score: session.score,
    questionsReached: session.reachedQuestionCount,
    totalQuestions: challenge.questions.length,
    livesRemaining: session.livesRemaining,
    totalTime: session.results.reduce((total, result) => total + result.timeUsed, 0),
    survived: session.survived,
  };
}

export function FlashPopSurvivalGame({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: SurvivalChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useSurvivalSession(scoredChallenge);
  const latestResult = session.results.at(-1);
  const finished = session.phase === "results" || session.phase === "review";
  const summary = finished ? toSummary(scoredChallenge, session) : null;
  const result = summary
    ? getFlashPopSurvivalResult(summary, { totalTimeLimit: totalTimeLimit(scoredChallenge) })
    : null;

  useChallengeCompletionReporter(
    session.phase === "results" && result
      ? {
          challengeId: challenge.id,
          points: result.score,
          completed: true,
          answers: session.results,
        }
      : null,
    onComplete,
  );

  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        maxWidth={session.phase === "intro" ? "none" : "wide"}
        contentClassName={session.phase === "intro" ? styles.introCanvasContent : styles.screen}
      >
        <AnimatePresence mode="wait">
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
            <StartCountdown label="Supervivencia" key="countdown" onComplete={session.start} />
          ) : null}

          {session.phase === "playing" && session.question ? (
            <motion.div
              key={session.question.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <QuestionScreen
                question={session.question}
                questionNumber={session.questionIndex + 1}
                totalQuestions={scoredChallenge.questions.length}
                locked={session.locked}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                codeAttemptCount={session.codeAttempts.length}
                onCodeAttempt={session.handleCodeAttempt}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={session.handleProgressiveClueReveal}
                onTimedResponseStart={session.handleTimedResponseStart}
                livesRemaining={session.livesRemaining}
                totalLives={scoredChallenge.lives}
              />
            </motion.div>
          ) : null}

          {session.phase === "transition" && latestResult ? (
            <motion.div
              className={styles.feedbackFrame}
              key={`feedback-${session.questionIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Feedback
                result={latestResult}
                questionNumber={session.questionIndex + 1}
                totalQuestions={scoredChallenge.questions.length}
                livesRemaining={session.livesRemaining}
                eliminated={session.eliminated}
                survived={session.survived}
              />
            </motion.div>
          ) : null}

          {session.phase === "results" && result ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <FlashPopSurvivalResult
                challenge={scoredChallenge}
                result={result}
                results={session.results}
                totalTime={summary?.totalTime ?? 0}
                eliminated={session.eliminated}
                onReview={session.showReview}
                onReplay={session.replay}
                returnTo={roomContext?.returnTo ?? "/"}
                roomContext={roomContext}
              />
            </motion.div>
          ) : null}

          {session.phase === "review" ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <ReviewAnswers
                challenge={scoredChallenge}
                results={session.results}
                onBack={session.showResults}
                onReplay={session.replay}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
