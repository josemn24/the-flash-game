"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, HeartIcon } from "@/components/ui";
import { Button, Card, Canvas, Chip, GameHeader } from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { QuestionScreen } from "@/components/game/shared/QuestionScreen";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";
import { useSurvivalSession } from "@/features/game/useSurvivalSession";
import {
  getFlashPopSurvivalResult,
  type FlashPopSurvivalSummary,
} from "@/features/flash-pop/survivalSocial";
import { withChallengeScoring } from "@/lib/challengeScoring";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import type { AnswerResult, SurvivalChallenge } from "@/types/game";
import { FlashPopSurvivalResult } from "./FlashPopSurvivalResult";
import styles from "./FlashPopSurvivalGame.module.css";

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function totalTimeLimit(challenge: SurvivalChallenge) {
  return challenge.questions.reduce((total, question) => total + question.timeLimit, 0);
}

function Intro({ challenge, onStart }: { challenge: SurvivalChallenge; onStart: () => void }) {
  const formats = [
    ...new Set(challenge.questions.map((question) => QUESTION_FORMAT_LABELS[question.type])),
  ];

  return (
    <div className={styles.stage}>
      <GameHeader title="Supervivencia" />
      <Card as="section" className={styles.introCard} aria-labelledby="survival-intro-title">
        <div className={styles.introAccent} aria-hidden="true">
          <HeartIcon />
          <strong>{challenge.lives}</strong>
          <small>vidas</small>
        </div>
        <Chip tone="social">Reto de hoy · Supervivencia</Chip>
        <h1 id="survival-intro-title">{challenge.title}</h1>
        <p className={styles.lead}>{challenge.subtitle}</p>
        <p className={styles.description}>{challenge.description}</p>

        <div className={styles.stats} aria-label="Resumen del desafío">
          <div>
            <strong>{challenge.questions.length}</strong>
            <span>preguntas</span>
          </div>
          <div>
            <strong>{challenge.lives}</strong>
            <span>vidas</span>
          </div>
          <div>
            <strong>{formatTime(totalTimeLimit(challenge))}</strong>
            <span>tiempo máximo</span>
          </div>
        </div>

        <div className={styles.formats} aria-label="Formatos incluidos">
          {formats.map((format) => (
            <Chip key={format} variant="data">
              {format}
            </Chip>
          ))}
        </div>

        <Button size="hero" fullWidth trailingIcon={<ArrowIcon />} onClick={onStart}>
          Empezar partida
        </Button>
        <p className={styles.note}>
          Acierto: conservas vida · parcial: sumas puntos · fallo o timeout: pierdes una vida ·
          hasta +120 ⚡
        </p>
      </Card>
    </div>
  );
}

function Feedback({
  result,
  questionNumber,
  totalQuestions,
  livesRemaining,
  totalLives,
  eliminated,
  survived,
}: {
  result: AnswerResult;
  questionNumber: number;
  totalQuestions: number;
  livesRemaining: number;
  totalLives: number;
  eliminated: boolean;
  survived: boolean;
}) {
  const failure = result.status === "incorrect" || result.status === "unanswered";
  const title = eliminated
    ? "Sin vidas"
    : survived
      ? "Has sobrevivido"
      : result.status === "correct"
        ? "Bien visto"
        : result.status === "partial"
          ? "Aproximación válida"
          : result.status === "unanswered"
            ? "Tiempo agotado"
            : "Casi.";
  const body = eliminated
    ? `Has llegado al reto ${questionNumber} de ${totalQuestions}.`
    : survived
      ? `Has completado los ${totalQuestions} retos.`
      : failure
        ? `Pierdes una vida. Te quedan ${livesRemaining}.`
        : result.status === "partial"
          ? `Sumas puntos y conservas tus ${livesRemaining} vidas.`
          : "Conservas tus vidas. Siguiente reto en marcha.";

  return (
    <FlashPopFeedback
      status={result.status}
      eyebrow={`Reto ${questionNumber} · ${livesRemaining}/${totalLives} vidas`}
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

export function FlashPopSurvivalGame({ challenge }: { challenge: SurvivalChallenge }) {
  const scoredChallenge = useMemo(() => withChallengeScoring(challenge), [challenge]);
  const session = useSurvivalSession(scoredChallenge);
  const latestResult = session.results.at(-1);
  const finished = session.phase === "results" || session.phase === "review";
  const summary = finished ? toSummary(scoredChallenge, session) : null;
  const result = summary
    ? getFlashPopSurvivalResult(summary, { totalTimeLimit: totalTimeLimit(scoredChallenge) })
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <Canvas contentClassName={styles.screen}>
        <AnimatePresence mode="wait">
          {session.phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro challenge={scoredChallenge} onStart={session.start} />
            </motion.div>
          ) : null}

          {session.phase === "playing" && session.question ? (
            <motion.div
              key={session.question.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <QuestionScreen
                variant="flash-pop"
                question={session.question}
                challengeTitle={scoredChallenge.title}
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
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Feedback
                result={latestResult}
                questionNumber={session.questionIndex + 1}
                totalQuestions={scoredChallenge.questions.length}
                livesRemaining={session.livesRemaining}
                totalLives={scoredChallenge.lives}
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
                variant="flash-pop"
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
