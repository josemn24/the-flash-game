"use client";

import { motion } from "motion/react";
import { ArrowIcon, Button, Card, CheckIcon } from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { ChallengeResultScreen } from "@/components/game/shared";
import { ServerFlashQuestionStage, StartCountdown } from "@/components/game/shared";
import { FlashPopReview } from "@/components/game/modes/flash-pop/FlashPopReview";
import { FlashPopGameShell } from "@/components/game/modes/flash-pop/FlashPopGameShell";
import { useServerFlashSession } from "@/features/game/useServerFlashSession";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import type { PyramidAttemptSummary } from "@/features/pyramid/pyramidAttempt";
import type { AnswerResult, GameRoomContext } from "@/types/game";
import type { ServerFlashTerminalReview, ServerPyramidChallenge } from "@/types/gameplay/challenge";
import styles from "./FlashPopPyramidGame.module.css";

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function PyramidFeedback({
  result,
  levelLabel,
  isLast,
}: {
  result: AnswerResult;
  levelLabel: string;
  isLast: boolean;
}) {
  const passed = result.status === "correct" && result.isCorrect;
  const timedOut = result.status === "unanswered";
  const status = passed ? "correct" : timedOut ? "unanswered" : "incorrect";
  const title = passed
    ? isLast
      ? "Desafío completado"
      : "Nivel superado"
    : timedOut
      ? "¡Se escapó por poco!"
      : "Casi.";
  const body = passed
    ? isLast
      ? "Has superado todos los niveles."
      : "Preparando la siguiente pregunta…"
    : "El ascenso termina en este nivel.";

  return (
    <FlashPopFeedback
      status={status}
      eyebrow={levelLabel}
      title={title}
      body={body}
      points={passed ? result.points : undefined}
    />
  );
}

function PyramidLevelMap({
  challenge,
  currentIndex,
}: {
  challenge: ServerPyramidChallenge;
  currentIndex: number;
}) {
  return (
    <ol className={styles.levelMap} aria-label="Niveles de La Pirámide">
      {[...challenge.levels].reverse().map((level, reversedIndex) => {
        const index = challenge.levels.length - reversedIndex - 1;
        const stateClass =
          index < currentIndex
            ? styles.levelTierCleared
            : index === currentIndex
              ? styles.levelTierCurrent
              : styles.levelTierLocked;
        const width = 45 + ((challenge.levels.length - index - 1) / 6) * 55;
        return (
          <li
            key={level.id}
            className={`${styles.levelTier} ${stateClass}`}
            style={{ width: `${width}%` }}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{level.label}</strong>
            {index < currentIndex ? <CheckIcon className={styles.levelTierIcon} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ServerFlashPopPyramidGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerPyramidChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerFlashSession({ challenge, roomContext, terminalReview });
  const currentLevel = challenge.levels[session.questionIndex];
  const reachedLevelCount = session.pyramidProgress?.reachedLevelCount ?? 0;
  const totalTime = session.results.reduce((sum, result) => sum + result.timeUsed, 0);
  const accuracy = calculateResultAccuracy(session.results.map(getAnswerResultAccuracyUnit));
  const outcome = session.pyramidProgress?.outcome;
  const reviewChallenge =
    session.reviewChallenge?.mode === "pyramid" ? session.reviewChallenge : null;
  const reviewLevels = challenge.levels.map((level) => {
    const reached = reviewChallenge?.levels.find((reviewLevel) => reviewLevel.id === level.levelId);
    return {
      id: level.levelId,
      resultQuestionId: level.id,
      label: level.label,
      briefingTitle: level.briefing.title,
      ...(reached ? { question: reached.question } : {}),
    };
  });
  const reviewSummary: PyramidAttemptSummary = {
    challengeId: challenge.id,
    startedAt: 0,
    levelsCleared: session.pyramidProgress?.levelsCleared ?? 0,
    score: session.score,
    timeUsed: totalTime,
    outcome: outcome === "summit" ? "summit" : "failed",
    completedAt: 0,
  };

  return (
    <FlashPopGameShell layout={session.phase === "intro" ? "intro" : "game"} presentation="pyramid">
      {session.phase === "intro" ? (
        <ChallengeIntro
          introduction={{
            title: challenge.title,
            mode: "pyramid",
            questionCount: challenge.levels.length,
            maxScore: challenge.maxScore,
          }}
          onStart={session.begin}
          canStart
          notice={session.startNotice}
          returnTo={roomContext.returnTo}
        />
      ) : null}

      {session.phase === "recovering" ? (
        <Card key="recovering" role="status" aria-live="polite" className="mx-auto mt-12 max-w-xl">
          <h1>Recuperando ascenso</h1>
          <p className="mt-2">
            Comprobamos el nivel y las respuestas confirmadas antes de continuar.
          </p>
        </Card>
      ) : null}

      {session.phase === "briefing" && currentLevel ? (
        <motion.div className={styles.briefing} key={`briefing-${currentLevel.id}`}>
          <PyramidLevelMap challenge={challenge} currentIndex={session.questionIndex} />
          <Card
            as="section"
            className={styles.briefingCard}
            aria-labelledby="pyramid-briefing-title"
          >
            <p className={styles.briefingFormat}>{currentLevel.briefing.format}</p>
            <h1 id="pyramid-briefing-title">{currentLevel.briefing.title}</h1>
            <p className={styles.briefingDescription}>{currentLevel.briefing.description}</p>
            <div className={styles.briefingStats} aria-label="Condiciones del nivel">
              <div className={styles.briefingStat}>
                <strong>{formatTime(currentLevel.timeLimitMs / 1000)}</strong>
                <span>tiempo límite</span>
              </div>
              <div className={styles.briefingStat}>
                <strong>{currentLevel.points} pts</strong>
                <span>máximo</span>
              </div>
            </div>
            <Button
              size="hero"
              fullWidth
              trailingIcon={<ArrowIcon />}
              onClick={session.startQuestions}
            >
              Empezar nivel
            </Button>
          </Card>
        </motion.div>
      ) : null}

      {session.phase === "countdown" ? (
        <StartCountdown label="La Pirámide" key="countdown" onComplete={session.startQuestions} />
      ) : null}

      {session.phase === "playing" && session.question ? (
        <motion.div className={styles.question} key={session.question.id}>
          <ServerFlashQuestionStage
            presentation="pyramid"
            question={session.question}
            questionNumber={session.questionIndex + 1}
            totalQuestions={challenge.levels.length}
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

      {session.phase === "transition" && session.lastResult ? (
        <PyramidFeedback
          key={`transition-${session.questionIndex}`}
          result={session.lastResult}
          levelLabel={currentLevel?.label ?? `Nivel ${session.questionIndex + 1}`}
          isLast={session.isTerminalQuestion}
        />
      ) : null}

      {session.phase === "results" && outcome ? (
        <ChallengeResultScreen
          model={{
            gameTitle: "La Pirámide",
            statusLabel: "Completado",
            eyebrow: "Desafío completado",
            title: outcome === "summit" ? "Cima conquistada" : "Ascenso terminado",
            subtitle: challenge.subtitle,
            score: session.score,
            maxScore: challenge.maxScore,
            scoreUnit: "flashPoints",
            accuracy,
            totalTime,
            metrics: [
              {
                icon: <CheckIcon />,
                label: "Niveles superados",
                value: `${session.pyramidProgress?.levelsCleared ?? 0} / ${challenge.levels.length}`,
                tone: outcome === "summit" ? "success" : "danger",
              },
              {
                icon: <CheckIcon />,
                label: "Niveles alcanzados",
                value: `${reachedLevelCount} / ${challenge.levels.length}`,
                tone: "social",
              },
            ],
          }}
          onReview={session.showReview}
          returnTo={roomContext.returnTo}
        />
      ) : null}

      {session.phase === "review" && reviewChallenge ? (
        <FlashPopReview
          challenge={reviewChallenge}
          results={session.results}
          summary={reviewSummary}
          levelMetadata={reviewLevels}
          totalLevelCount={challenge.levels.length}
          onBack={session.showResults}
        />
      ) : null}
    </FlashPopGameShell>
  );
}
