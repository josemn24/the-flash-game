"use client";

import { motion } from "motion/react";
import {
  ReviewStage,
  Transition,
} from "@/components/game/modes/flash-pop/FlashPopFlashGame.client";
import { FlashPopGameShell } from "@/components/game/modes/flash-pop/FlashPopGameShell";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ServerFlashQuestionStage, StartCountdown } from "@/components/game/shared";
import { Card } from "@/components/ui";
import { SurvivalResultScreen } from "@/components/game/shared/SurvivalResultScreen/SurvivalResultScreen";
import { useServerFlashSession } from "@/features/game/useServerFlashSession";
import type { GameRoomContext, SurvivalChallenge } from "@/types/game";
import type {
  ServerFlashTerminalReview,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";
import styles from "./FlashPopFlashGame.module.css";

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
  const survivalChallenge: SurvivalChallenge = {
    id: challenge.id,
    definitionId: challenge.definitionId,
    number: challenge.number,
    title: challenge.title,
    subtitle: challenge.subtitle,
    description: challenge.description,
    mode: "survival",
    lives: challenge.lives,
    questions: session.displayChallenge.questions,
  };

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
            matchingState={session.matchingState}
            matchingStatusVisible={session.matchingStatusVisible}
            matchingError={session.matchingError}
            lastMatchingPair={session.lastMatchingPair}
            onMatchingPair={(leftId, rightId) => void session.submitMatchingPair(leftId, rightId)}
            onRetryMatching={() => void session.retryMatchingPair()}
            queensState={session.queensState}
            queensStatusVisible={session.queensStatusVisible}
            queensError={session.queensError}
            onQueensPlacement={(cell, action) => void session.submitQueensPlacement(cell, action)}
            onRetryQueens={() => void session.retryQueensPlacement()}
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
            onTimeUp={() =>
              void session.submit(
                session.question?.type === "classification" ||
                  session.question?.type === "estimation" ||
                  session.question?.type === "heat-map" ||
                  session.question?.type === "zip" ||
                  session.question?.type === "escape"
                  ? session.pendingAnswer
                  : null,
              )
            }
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
            isLast={session.isTerminalQuestion}
          />
        </motion.div>
      ) : null}
      {session.phase === "results" && session.survivalProgress ? (
        <motion.div
          className={styles.stageFrame}
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <SurvivalResultScreen
            challenge={survivalChallenge}
            results={session.results}
            score={session.score}
            livesRemaining={session.survivalProgress.livesRemaining}
            reachedQuestionCount={session.survivalProgress.reachedQuestionCount}
            eliminated={session.survivalProgress.outcome === "eliminated"}
            survived={session.survivalProgress.outcome === "survived"}
            onReview={() => session.reviewChallenge && session.showReview()}
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
          />
        </motion.div>
      ) : null}
    </FlashPopGameShell>
  );
}
