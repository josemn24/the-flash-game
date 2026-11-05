"use client";

import { motion } from "motion/react";
import { CompetitiveLifecycleNotice } from "@/components/game/shared/CompetitiveLifecycleNotice";
import { AnswerFeedbackStage } from "@/components/game/modes/flash-pop/AnswerFeedbackStage";
import {
  buildResultModel,
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
import { Card } from "@/components/ui";
import type { FlashGameSession } from "@/features/game/useFlashGameSession";
import type { ServerFlashChallenge } from "@/types/gameplay/challenge";
import styles from "./FlashPopFlashGame.module.css";

export function FlashGameView({
  challenge,
  session,
  returnTo,
  onReplay,
  prefetchReturnTo = true,
}: {
  readonly challenge: ServerFlashChallenge;
  readonly session: FlashGameSession;
  readonly returnTo?: string;
  readonly onReplay?: () => void;
  readonly prefetchReturnTo?: boolean;
}) {
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
              mode: "flash",
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
          <p className="mt-2">Comprobamos de forma segura el último estado de tu intento.</p>
        </Card>
      ) : null}
      {session.phase === "countdown" ? (
        <StartCountdown label="Flash" key="countdown" onComplete={session.startQuestions} />
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
            onReview={session.reviewChallenge ? session.showReview : undefined}
            onReplay={onReplay}
            expired={session.attemptExpired}
            returnTo={returnTo}
            prefetchReturnLink={prefetchReturnTo}
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
            returnTo={returnTo ?? "/"}
            presentation="flash"
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
