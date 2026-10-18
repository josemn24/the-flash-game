"use client";

import { motion } from "motion/react";
import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";
import { AnswerFeedbackStage } from "@/components/game/modes/flash-pop/AnswerFeedbackStage";
import {
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopCompetitiveHelpers";
import { FlashPopGameShell } from "@/components/game/modes/flash-pop/FlashPopGameShell";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import {
  ChallengeResultScreen,
  SessionQuestionStage,
  StartCountdown,
} from "@/components/game/shared";
import { Card, CheckIcon, ClockIcon, CrossIcon, HeartIcon } from "@/components/ui";
import type { SurvivalGameSession } from "@/features/game/useSurvivalGameSession";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import type { ChallengeResultModel } from "@/components/game/shared";
import type { AnswerResult } from "@/types/gameplay/result";
import type { ServerSurvivalChallenge } from "@/types/gameplay/challenge";
import styles from "./FlashPopFlashGame.module.css";

function getSurvivalResultModel(
  challenge: ServerSurvivalChallenge,
  results: AnswerResult[],
  score: number,
  progress: SurvivalGameSession["survivalProgress"],
): ChallengeResultModel {
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const survived = progress.outcome === "survived";
  const eliminated = progress.outcome === "eliminated";

  return {
    gameTitle: "Supervivencia",
    statusLabel: survived ? "Completado" : "Partida terminada",
    eyebrow: challenge.title,
    title: survived ? "Has sobrevivido" : eliminated ? "Sin vidas" : "Buen intento",
    subtitle: survived
      ? `Has completado los ${challenge.slots.length} retos.`
      : `Has llegado al reto ${progress.reachedQuestionCount} de ${challenge.slots.length}.`,
    score,
    maxScore: challenge.maxScore,
    scoreUnit: "flashPoints",
    accuracy: calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit)),
    totalTime: results.reduce((total, result) => total + result.timeUsed, 0),
    metrics: [
      {
        label: "Retos alcanzados",
        value: `${progress.reachedQuestionCount} / ${challenge.slots.length}`,
        icon: <CheckIcon />,
        tone: "success",
      },
      {
        label: "Vidas consumidas",
        value: challenge.lives - progress.livesRemaining,
        icon: <CrossIcon />,
        tone: "danger",
      },
      {
        label: "Vidas restantes",
        value: progress.livesRemaining,
        icon: <HeartIcon />,
        tone: "social",
      },
      {
        label: "Sin contestar",
        value: unanswered,
        icon: <ClockIcon />,
      },
    ],
  };
}

export function SurvivalGameView({
  challenge,
  session,
  returnTo = "/",
  returnLabel = "Volver a la sala",
  onReplay,
}: {
  readonly challenge: ServerSurvivalChallenge;
  readonly session: SurvivalGameSession;
  readonly returnTo?: string;
  readonly returnLabel?: string;
  readonly onReplay?: () => void;
}) {
  const resultModel = getSurvivalResultModel(
    challenge,
    session.results,
    session.score,
    session.survivalProgress,
  );

  return (
    <FlashPopGameShell
      notice={
        <CompetitiveLifecycleNotice
          error={session.lifecycleError}
          busy={session.busy}
          onRetry={session.retryLifecycle}
        />
      }
      layout={session.phase === "intro" ? "intro" : "game"}
    >
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
              mode: "survival",
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
            returnTo={returnTo}
          />
        </motion.div>
      ) : null}
      {session.phase === "recovering" ? (
        <Card key="recovering" role="status" aria-live="polite" className="mx-auto mt-12 max-w-xl">
          <h1>Recuperando partida</h1>
          <p className="mt-2">Comprobamos vidas y respuestas confirmadas antes de continuar.</p>
        </Card>
      ) : null}
      {session.phase === "countdown" ? (
        <StartCountdown label="Supervivencia" key="countdown" onComplete={session.startQuestions} />
      ) : null}
      {session.phase === "playing" && session.question && session.questionInput ? (
        <motion.div
          className={styles.stageFrame}
          key={session.question.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
        >
          <SessionQuestionStage
            input={session.questionInput}
            questionNumber={session.questionIndex + 1}
            totalQuestions={challenge.slots.length}
            livesRemaining={session.survivalProgress.livesRemaining}
            totalLives={challenge.lives}
            deadlineAt={session.questionDeadlineAt}
            onTimeUp={() => void session.handleTimeUp()}
          />
        </motion.div>
      ) : null}
      {session.phase === "checking" ? (
        session.answerVerificationState === "error" ? (
          <AnswerFeedbackStage
            key={`checking-error-${session.questionIndex}`}
            state="error"
            errorMessage={
              session.answerVerificationError ?? "No hemos podido confirmar tu respuesta."
            }
            onRetry={session.retrySubmit}
          />
        ) : (
          <AnswerFeedbackStage
            key={`checking-${session.questionIndex}`}
            state="checking"
            indicatorVisible={session.answerVerificationStatusVisible}
          />
        )
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
            isLast={session.isTerminalQuestion}
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
            model={resultModel}
            onReview={session.reviewChallenge ? session.showReview : undefined}
            onReplay={onReplay}
            expired={session.attemptExpired}
            returnTo={returnTo}
            returnLabel={returnLabel}
          />
        </motion.div>
      ) : null}
      {session.phase === "review" && session.reviewChallenge?.mode === "flash" ? (
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
            onReplay={onReplay}
            returnTo={returnTo}
            presentation="survival"
            totalQuestionCount={challenge.slots.length}
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
