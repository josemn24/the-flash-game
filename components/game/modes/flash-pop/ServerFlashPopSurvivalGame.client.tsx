"use client";

import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";

import { motion } from "motion/react";
import {
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopCompetitiveHelpers";
import { AnswerFeedbackStage } from "@/components/game/modes/flash-pop/AnswerFeedbackStage";
import { FlashPopGameShell } from "@/components/game/modes/flash-pop/FlashPopGameShell";
import { ChallengeIntro, ChallengeResultScreen } from "@/components/game/shared";
import { ServerFlashQuestionStage, StartCountdown } from "@/components/game/shared";
import { CheckIcon, ClockIcon, CrossIcon, HeartIcon, Card } from "@/components/ui";
import type { ChallengeResultModel } from "@/components/game/shared";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import { useServerFlashSession } from "@/features/game/useServerFlashSession";
import type { AnswerResult } from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import type {
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import type { SurvivalProgress } from "@/lib/gameplay/survivalProgress";
import styles from "./FlashPopFlashGame.module.css";

function getSurvivalResultModel(
  challenge: ServerSurvivalChallenge,
  results: AnswerResult[],
  score: number,
  progress: SurvivalProgress,
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

export function ServerFlashPopSurvivalGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerSurvivalChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerFlashSession({ challenge, roomContext, terminalReview });
  const resultModel = session.survivalProgress
    ? getSurvivalResultModel(challenge, session.results, session.score, session.survivalProgress)
    : null;

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
            returnTo={roomContext.returnTo}
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
      {session.phase === "playing" && session.question && session.survivalProgress ? (
        <motion.div
          className={styles.stageFrame}
          key={session.question.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
        >
          <ServerFlashQuestionStage
            question={session.question}
            questionNumber={session.questionIndex + 1}
            totalQuestions={challenge.slots.length}
            livesRemaining={session.survivalProgress.livesRemaining}
            totalLives={challenge.lives}
            locked={session.locked}
            deadlineAt={session.questionDeadlineAt}
            presentedAt={session.questionPresentedAt}
            pendingAnswer={session.pendingAnswer}
            submissionState={session.submissionState}
            submissionStatusVisible={session.submissionStatusVisible}
            submissionError={session.submissionError}
            onRetrySubmission={session.retrySubmit}
            onSubmit={(answer) => void session.submit(answer)}
            onProgress={session.updateDraft}
            onMiniWordleGuess={session.submitMiniWordleGuess}
            onLogicCodeAttempt={session.submitLogicCodeAttempt}
            queensState={session.queensState}
            queensStatusVisible={session.queensStatusVisible}
            queensError={session.queensError}
            onQueensDraft={session.updateQueensDraft}
            onQueensValidate={(queens) => void session.validateQueensBoard(queens)}
            onRetryQueensValidation={() => void session.retryQueensValidation()}
            wordSearchState={session.wordSearchState}
            wordSearchStatusVisible={session.wordSearchStatusVisible}
            wordSearchError={session.wordSearchError}
            lastWordSearchSelection={session.lastWordSearchSelection}
            onWordSearchSelection={(startCell, endCell) =>
              void session.submitWordSearchSelection(startCell, endCell)
            }
            onRetryWordSearch={() => void session.retryWordSearchSelection()}
            onWordHashtagSwap={(fromCell, toCell) =>
              void session.submitWordHashtagSwap(fromCell, toCell)
            }
            revealState={session.revealState}
            revealStatusVisible={session.revealStatusVisible}
            revealError={session.revealError}
            onRevealProgressiveClue={() => void session.revealProgressiveClue()}
            onRetryReveal={() => void session.retryReveal()}
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
      {session.phase === "results" && resultModel ? (
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
            expired={session.attemptExpired}
            returnTo={roomContext.returnTo}
            returnLabel="Volver a la sala"
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
            returnTo={roomContext.returnTo}
            roomContext={roomContext}
            presentation="survival"
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
