"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, BoltIcon, CheckIcon } from "@/components/ui";
import { Button, ButtonLink, Canvas, Card, GameHeader, Timer } from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ChallengeResultScreen } from "@/components/game/shared";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import { CHALLENGE_MAX_SCORE, withPyramidScoring } from "@/lib/challengeScoring";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { FlashPopReview } from "@/components/game/modes/flash-pop/FlashPopReview";
import { getFlashPopResult, type FlashPopResult } from "@/features/flash-pop/demoSocial";
import { useChallengeCompletionReporter } from "@/features/game/useChallengeCompletionReporter";
import type {
  AnswerValue,
  ChallengeCompletionResult,
  GameRoomContext,
  PyramidChallenge,
  PyramidLevel,
  AnswerResult,
} from "@/types/game";
import styles from "./FlashPopPyramidGame.module.css";

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function getChallengeTimeLimit(challenge: PyramidChallenge) {
  return challenge.levels.reduce((total, level) => total + level.question.timeLimit, 0);
}

function LevelIndicator({ levelIndex, levelCount }: { levelIndex: number; levelCount: number }) {
  return (
    <p className={styles.levelIndicator} aria-label={`Nivel ${levelIndex + 1} de ${levelCount}`}>
      Nivel {levelIndex + 1} <span>de {levelCount}</span>
    </p>
  );
}

function LevelMap({ levels, currentIndex }: { levels: PyramidLevel[]; currentIndex: number }) {
  return (
    <ol className={styles.levelMap} aria-label="Niveles de La Pirámide">
      {[...levels].reverse().map((level, reversedIndex) => {
        const index = levels.length - reversedIndex - 1;
        const stateClass =
          index < currentIndex
            ? styles.levelTierCleared
            : index === currentIndex
              ? styles.levelTierCurrent
              : styles.levelTierLocked;
        const width = 45 + ((levels.length - index - 1) / Math.max(1, levels.length - 1)) * 55;

        return (
          <li
            key={level.id}
            className={`${styles.levelTier} ${stateClass}`}
            style={{ width: `${width}%` }}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{level.label}</strong>
            {index < currentIndex && <CheckIcon className={styles.levelTierIcon} />}
          </li>
        );
      })}
    </ol>
  );
}

function Topbar({
  timer,
  mobileLabel,
  mobileLabelAriaLabel,
}: {
  timer?: React.ReactNode;
  mobileLabel?: React.ReactNode;
  mobileLabelAriaLabel?: string;
}) {
  return (
    <GameHeader
      title="La Pirámide"
      timer={timer}
      mobileLabel={mobileLabel}
      mobileLabelAriaLabel={mobileLabelAriaLabel}
    />
  );
}

function Intro({
  challenge,
  onStart,
  returnTo,
}: {
  challenge: PyramidChallenge;
  onStart: () => void;
  returnTo?: string;
}) {
  return <ChallengeIntro challenge={challenge} onStart={onStart} returnTo={returnTo} />;
}

function Briefing({
  level,
  levels,
  levelIndex,
  onStart,
}: {
  level: PyramidLevel;
  levels: PyramidLevel[];
  levelIndex: number;
  onStart: () => void;
}) {
  return (
    <div className={styles.briefing}>
      <LevelMap levels={levels} currentIndex={levelIndex} />
      <Card as="section" className={styles.briefingCard} aria-labelledby="briefing-title">
        <p className={styles.briefingFormat}>{level.briefing.format}</p>
        <h1 id="briefing-title">{level.briefing.title}</h1>
        <p className={styles.briefingDescription}>{level.briefing.description}</p>
        <div className={styles.briefingStats} aria-label="Condiciones del nivel">
          <div className={styles.briefingStat}>
            <strong>{formatTime(level.question.timeLimit)}</strong>
            <span>tiempo límite</span>
          </div>
          <div className={styles.briefingStat}>
            <strong>{level.question.points} pts</strong>
            <span>máximo</span>
          </div>
        </div>
        <Button
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.briefingAction}
          onClick={onStart}
        >
          Empezar nivel
        </Button>
      </Card>
    </div>
  );
}

function getPromptScale(question: PyramidLevel["question"]) {
  if (question.question.length > 100) return styles.questionPromptLong;
  if (question.question.length > 54) return styles.questionPromptMedium;
  return "";
}

function Question({
  level,
  levelIndex,
  levelCount,
  deadlineAt,
  onReady,
  locked,
  onSubmit,
  onTimeUp,
  onProgress,
  onIncorrectAttempt,
  onProgressiveClueReveal,
  onCodeAttempt,
  onTimedResponseStart,
  initialAnswer,
  attemptCount,
  progressiveCluesRevealed,
}: {
  level: PyramidLevel;
  levelIndex: number;
  levelCount: number;
  deadlineAt: number | null;
  onReady: () => void;
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onCodeAttempt: (code: string) => boolean;
  onTimedResponseStart: () => void;
  initialAnswer: AnswerValue | null;
  attemptCount: number;
  progressiveCluesRevealed: number;
}) {
  const question = level.question;
  const delayedTimer = question.type === "mini-wordle";

  useEffect(() => {
    if (!delayedTimer) onReady();
  }, [delayedTimer, onReady]);

  return (
    <div className={styles.question}>
      <Topbar
        mobileLabel={
          <>
            Nivel {levelIndex + 1} <span className={styles.mobileLabelMuted}>de {levelCount}</span>
          </>
        }
        mobileLabelAriaLabel={`Nivel ${levelIndex + 1} de ${levelCount}`}
        timer={
          <Timer
            duration={question.timeLimit}
            active={typeof deadlineAt === "number"}
            deadlineAt={deadlineAt ?? undefined}
            onTimeUp={onTimeUp}
            resetKey={question.id}
          />
        }
      />
      <LevelIndicator levelIndex={levelIndex} levelCount={levelCount} />
      <Card as="section" className={styles.questionCard} aria-labelledby="question-title">
        <h1 id="question-title" className={`${styles.questionPrompt} ${getPromptScale(question)}`}>
          {question.question}
        </h1>
        <QuestionInput
          question={question}
          locked={locked}
          initialAnswer={initialAnswer}
          onSubmit={onSubmit}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onCodeAttempt={onCodeAttempt}
          onTimedResponseStart={() => {
            if (delayedTimer) onReady();
            onTimedResponseStart();
          }}
          progressiveCluesRevealed={progressiveCluesRevealed}
          codeAttemptCount={attemptCount}
        />
      </Card>
    </div>
  );
}

function expectedAnswerLabel(level: PyramidLevel) {
  const question = level.question;
  switch (question.type) {
    case "odd-one-out":
      return (
        question.items.find((item) => item.id === question.correctAnswer)?.label ??
        question.correctAnswer
      );
    case "multiple-choice":
      return question.correctAnswer;
    case "ordering":
      return question.correctOrder.join(" → ");
    case "logic-matrix":
      return (
        question.pieces.find((piece) => piece.id === question.correctOptionId)?.label ??
        "La pieza correcta"
      );
    case "connect-pairs":
      return question.requireFullCoverage
        ? "Las parejas y la cobertura completa"
        : "Todas las parejas conectadas";
    case "logic-code":
      return question.correctAnswer;
    case "queens":
      return "La disposición correcta de las coronas";
    case "matching":
      return "Todas las asociaciones correctas";
    case "progressive-clues":
      return question.correctAnswer;
    case "mini-wordle":
      return question.correctAnswer;
    case "word-search":
      return "Todos los personajes encontrados";
    case "classification":
      return "La clasificación correcta";
    case "word-hashtag":
      return "Las cuatro referencias completas";
    default:
      return "La respuesta correcta";
  }
}

function Feedback({
  result,
  level,
  levelIndex,
  levelCount,
}: {
  result: NonNullable<ReturnType<typeof usePyramidSession>["latestResult"]>;
  level: PyramidLevel;
  levelIndex: number;
  levelCount: number;
}) {
  const passed = result.status === "correct" && result.isCorrect;
  const timedOut = result.status === "unanswered";
  const summit = levelIndex + 1 >= levelCount;
  const title = passed
    ? summit
      ? "Desafío completado"
      : "Nivel superado"
    : timedOut
      ? "¡Se escapó por poco!"
      : "Casi.";
  const body = passed
    ? summit
      ? "Has superado todos los niveles."
      : "Preparando la siguiente pregunta…"
    : `La respuesta correcta era ${expectedAnswerLabel(level)}.`;

  return (
    <FlashPopFeedback
      status={passed ? "correct" : timedOut ? "unanswered" : "incorrect"}
      eyebrow={level.label}
      title={title}
      body={body}
      points={passed ? result.points : undefined}
    />
  );
}

function Result({
  challenge,
  result,
  results,
  totalTime,
  onReview,
  onReplay,
  returnTo,
  roomContext,
}: {
  challenge: PyramidChallenge;
  result: FlashPopResult;
  results: AnswerResult[];
  totalTime: number;
  onReview: () => void;
  onReplay: () => void;
  returnTo: string;
  roomContext?: GameRoomContext;
}) {
  const summit = result.levelsCleared >= challenge.levels.length;
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
  return (
    <ChallengeResultScreen
      model={{
        gameTitle: "La Pirámide",
        statusLabel: "Completado",
        eyebrow: "Desafío completado",
        title: summit ? "Cima conquistada" : "Ascenso terminado",
        subtitle: challenge.subtitle,
        score: result.score,
        maxScore: CHALLENGE_MAX_SCORE,
        accuracy,
        totalTime,
        metrics: [
          {
            icon: <CheckIcon />,
            label: "Niveles superados",
            value: `${result.levelsCleared} / ${challenge.levels.length}`,
            tone: "success",
          },
          ...(!roomContext
            ? [
                {
                  icon: <BoltIcon />,
                  label: "Posición",
                  value: `${result.playerRank}.º / ${result.totalPlayers}`,
                  tone: "social" as const,
                },
              ]
            : []),
          {
            icon: <BoltIcon />,
            label: "XP de temporada",
            value: `+${result.seasonXpEarned} ⚡`,
            tone: "social",
          },
        ],
      }}
      onReview={onReview}
      onReplay={onReplay}
      returnTo={returnTo}
      returnLabel={roomContext ? "Volver a Tabarnia" : "Volver al lobby"}
    />
  );
}

export function FlashPopPyramidGame({
  challenge,
  roomContext,
  onComplete,
}: {
  challenge: PyramidChallenge;
  roomContext?: GameRoomContext;
  onComplete?: (result: ChallengeCompletionResult) => void;
}) {
  const scoredChallenge = useMemo(() => withPyramidScoring(challenge), [challenge]);
  const session = usePyramidSession(scoredChallenge, {
    persistence: "memory",
    feedbackDuration: { correct: 1100, incorrect: 1800, unanswered: 1800 },
  });
  const currentLevel = session.currentLevel ?? challenge.levels[0];
  const currentLevelIndex = session.record?.currentLevelIndex ?? 0;

  useChallengeCompletionReporter(
    session.phase === "results" && session.summary
      ? {
          challengeId: challenge.id,
          points: session.summary.score,
          completed: true,
          answers: session.record?.results ?? [],
        }
      : null,
    onComplete,
  );

  if (challenge.mode !== "pyramid" || challenge.levels.length === 0 || !currentLevel) {
    return (
      <Canvas maxWidth="content">
        <Card>
          <h1>Reto no disponible</h1>
          <p>Este reto no tiene niveles configurados.</p>
          <ButtonLink href={roomContext?.returnTo ?? "/"} className={styles.action}>
            Volver al lobby
          </ButtonLink>
        </Card>
      </Canvas>
    );
  }

  const result = session.summary
    ? getFlashPopResult(session.summary, {
        levelCount: challenge.levels.length,
        totalTimeLimit: getChallengeTimeLimit(challenge),
      })
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <Canvas
        maxWidth={session.phase === "intro" ? "none" : "wide"}
        contentClassName={session.phase === "intro" ? styles.introCanvasContent : styles.screen}
      >
        <AnimatePresence mode="wait">
          {session.phase === "loading" ? (
            <motion.div
              key="loading"
              className={styles.briefing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Topbar />
              <Card className={styles.briefingCard}>
                <BoltIcon />
                <p>Preparando tu ascenso…</p>
              </Card>
            </motion.div>
          ) : null}
          {session.phase === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro
                challenge={challenge}
                onStart={session.start}
                returnTo={roomContext?.returnTo}
              />
            </motion.div>
          ) : null}
          {session.phase === "briefing" ? (
            <motion.div
              key="briefing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <Briefing
                level={currentLevel}
                levels={challenge.levels}
                levelIndex={currentLevelIndex}
                onStart={session.beginLevel}
              />
            </motion.div>
          ) : null}
          {session.phase === "playing" ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
            >
              <Question
                level={currentLevel}
                levelIndex={currentLevelIndex}
                levelCount={challenge.levels.length}
                deadlineAt={session.deadlineAt}
                locked={session.locked}
                onReady={session.armCurrentLevel}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={session.handleProgressiveClueReveal}
                onCodeAttempt={session.handleCodeAttempt}
                onTimedResponseStart={session.armCurrentLevel}
                initialAnswer={session.initialAnswer}
                attemptCount={session.codeAttempts.length}
                progressiveCluesRevealed={session.record?.progressiveCluesRevealed ?? 1}
              />
            </motion.div>
          ) : null}
          {session.phase === "transition" && session.latestResult ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Feedback
                result={session.latestResult}
                level={currentLevel}
                levelIndex={currentLevelIndex}
                levelCount={challenge.levels.length}
              />
            </motion.div>
          ) : null}
          {session.phase === "results" && result ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Result
                challenge={challenge}
                result={result}
                results={session.record?.results ?? []}
                totalTime={session.summary?.timeUsed ?? 0}
                onReview={session.showReview}
                onReplay={session.restart}
                returnTo={roomContext?.returnTo ?? "/"}
                roomContext={roomContext}
              />
            </motion.div>
          ) : null}
          {session.phase === "review" && session.summary && session.record ? (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.review}>
                <Topbar />
                <FlashPopReview
                  challenge={scoredChallenge}
                  results={session.record.results}
                  summary={session.summary}
                  onBack={session.showResults}
                  onReplay={session.restart}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Canvas>
    </MotionConfig>
  );
}
