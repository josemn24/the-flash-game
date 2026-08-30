"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, BoltIcon, CheckIcon, ClockIcon, CrossIcon } from "@/components/icons";
import {
  PopAvatar,
  PopButton,
  PopButtonLink,
  PopCanvas,
  PopCard,
  PopChip,
  PopTimer,
} from "@/components/flash-pop/ui";
import { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import { withPyramidScoring } from "@/lib/challengeScoring";
import { FlashPopQuestionInput } from "@/components/flash-pop/FlashPopQuestionInput";
import { FlashPopReview } from "@/components/flash-pop/FlashPopReview";
import {
  FLASH_POP_CHALLENGE_ID,
  FLASH_POP_LEVEL_COUNT,
  FLASH_POP_STORAGE_NAMESPACE,
  getFlashPopResult,
  type FlashPopResult,
} from "@/features/flash-pop/demoSocial";
import type { AnswerValue, PyramidChallenge, PyramidLevel } from "@/types/game";
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

function Topbar({ timer }: { timer?: React.ReactNode }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <span className={styles.brandMark} aria-hidden="true">
          <BoltIcon />
        </span>
        <span className={styles.brandCopy}>
          <strong>La Pirámide</strong>
        </span>
      </div>
      {timer ? <div className={styles.topbarRight}>{timer}</div> : null}
    </div>
  );
}

function Intro({
  challenge,
  storageAvailable,
  confirming,
  onConfirm,
  onCancel,
  onStart,
}: {
  challenge: PyramidChallenge;
  storageAvailable: boolean;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <div className={styles.intro}>
      <Topbar />
      <PopCard as="section" className={styles.introCard} aria-labelledby="flash-pop-intro-title">
        <div className={styles.introIllustration} aria-hidden="true" />
        <PopChip tone="social">Reto de hoy · Demo</PopChip>
        <h1 id="flash-pop-intro-title">La Pirámide</h1>
        <p className={styles.introLead}>Siete pruebas de lógica. Sube cuanto puedas.</p>

        <div className={styles.rules}>
          <div className={styles.rule}>
            <strong>Siete niveles</strong>
            <span>De un patrón numérico a la cima de Queens.</span>
          </div>
          <div className={styles.rule}>
            <strong>Un intento</strong>
            <span>Tu respuesta oficial no se puede repetir.</span>
          </div>
        </div>

        {storageAvailable ? null : (
          <p className={styles.storageWarning} role="alert">
            Esta partida no se recuperará después de recargar la página.
          </p>
        )}

        <PopButton
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.action}
          onClick={onConfirm}
        >
          Empezar intento
        </PopButton>
        <p className={styles.attemptNote}>
          {challenge.levels.length} niveles · {formatTime(getChallengeTimeLimit(challenge))} · Hasta
          +120 ⚡
        </p>
      </PopCard>

      {confirming ? (
        <div
          className={styles.feedbackCard}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <h1 id="confirm-title">¿Listo para subir?</h1>
          <p>Tienes un único intento oficial. El reloj comienza al mostrar la pregunta.</p>
          <PopButton size="hero" fullWidth trailingIcon={<ArrowIcon />} onClick={onStart}>
            Confirmar intento
          </PopButton>
          <PopButton variant="secondary" fullWidth onClick={onCancel}>
            Todavía no
          </PopButton>
        </div>
      ) : null}
    </div>
  );
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
      <Topbar />
      <LevelMap levels={levels} currentIndex={levelIndex} />
      <PopCard as="section" className={styles.briefingCard} aria-labelledby="briefing-title">
        <h1 id="briefing-title">{level.briefing.title}</h1>
        <p className={styles.briefingFormat}>{level.briefing.format}</p>
        <p className={styles.briefingDescription}>{level.briefing.description}</p>
        <div className={styles.briefingStats} aria-label="Condiciones del nivel">
          <div className={styles.briefingStat}>
            <strong>{formatTime(level.question.timeLimit)}</strong>
            <span>tiempo</span>
          </div>
          <div className={styles.briefingStat}>
            <strong>{level.question.points} pts</strong>
            <span>máximo del nivel</span>
          </div>
        </div>
        <PopButton
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.briefingAction}
          onClick={onStart}
        >
          Empezar nivel
        </PopButton>
      </PopCard>
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
  onCodeAttempt,
  onTimedResponseStart,
  initialAnswer,
  attemptCount,
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
  onCodeAttempt: (code: string) => boolean;
  onTimedResponseStart: () => void;
  initialAnswer: AnswerValue | null;
  attemptCount: number;
}) {
  const question = level.question;

  useEffect(() => onReady(), [onReady]);

  return (
    <div className={styles.question}>
      <Topbar
        timer={
          <PopTimer
            duration={question.timeLimit}
            active={typeof deadlineAt === "number"}
            deadlineAt={deadlineAt ?? undefined}
            onTimeUp={onTimeUp}
            resetKey={question.id}
          />
        }
      />
      <LevelIndicator levelIndex={levelIndex} levelCount={levelCount} />
      <PopCard as="section" className={styles.questionCard} aria-labelledby="question-title">
        <h1
          id="question-title"
          className={`${styles.questionPrompt} ${getPromptScale(question)}`}
        >
          {question.question}
        </h1>
        <FlashPopQuestionInput
          level={level}
          levelIndex={levelIndex}
          levelCount={levelCount}
          locked={locked}
          initialAnswer={initialAnswer}
          onSubmit={onSubmit}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onCodeAttempt={onCodeAttempt}
          onTimedResponseStart={onTimedResponseStart}
          attemptCount={attemptCount}
        />
      </PopCard>
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
  const title = passed ? "¡Bien visto!" : timedOut ? "¡Se escapó por poco!" : "Casi.";
  const body = passed
    ? level.question.explanation
    : `La respuesta correcta era ${expectedAnswerLabel(level)}.`;

  return (
    <div className={styles.question}>
      <Topbar />
      <LevelIndicator levelIndex={levelIndex} levelCount={levelCount} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <PopCard className={`${styles.feedbackCard} ${passed ? "" : styles.failure}`}>
          <span className={styles.feedbackIcon} aria-hidden="true">
            {passed ? <CheckIcon /> : timedOut ? <ClockIcon /> : <CrossIcon />}
          </span>
          <h1>{title}</h1>
          <p>{body}</p>
          {!passed ? <p className={styles.correctAnswer}>{level.question.explanation}</p> : null}
          {passed ? <p className={styles.correctAnswer}>+{result.points} puntos</p> : null}
        </PopCard>
      </motion.div>
    </div>
  );
}

function Result({ result, onReview }: { result: FlashPopResult; onReview: () => void }) {
  const summit = result.levelsCleared >= FLASH_POP_LEVEL_COUNT;
  return (
    <div className={styles.result}>
      <Topbar />
      <PopCard as="section" className={styles.resultCard} aria-labelledby="result-title">
        <PopChip variant="reward">Resultado · Demo</PopChip>
        <h1 id="result-title">{summit ? "Cima conquistada" : "Ascenso terminado"}</h1>
        <div className={styles.resultScore}>{result.score}</div>
        <p className={styles.resultScoreLabel}>puntos de partida</p>
        <div className={styles.resultMeta}>
          <div className={styles.resultStat}>
            <strong>
              {result.levelsCleared} / {FLASH_POP_LEVEL_COUNT}
            </strong>
            <span>niveles superados</span>
          </div>
          <div className={styles.resultStat}>
            <strong>{result.playerRank}.º</strong>
            <span>posición · {result.totalPlayers}</span>
          </div>
          <div className={styles.resultStat}>
            <strong>+{result.seasonXpEarned} ⚡</strong>
            <span>XP de temporada</span>
          </div>
        </div>
        <p className={styles.xpCallout}>
          {result.seasonXpCurrent} / {result.nextLevelAt} ⚡ · Sigue subiendo
        </p>

        <div className={styles.ranking} aria-label="Clasificación demo">
          <h2>
            Tu grupo <span className={styles.metaLabel}>· Demo</span>
          </h2>
          {result.peers.map((row) => (
            <div
              className={`${styles.rankingRow} ${row.player.id === "javi" ? styles.current : ""}`}
              key={row.player.id}
            >
              <span className={styles.rankingPosition}>{row.rank}.</span>
              <PopAvatar
                name={row.player.displayName}
                initials={row.player.initials}
                tone={row.player.tone}
                size="sm"
              />
              <span className={styles.rankingName}>
                {row.player.id === "javi" ? "Tú" : row.player.displayName}
              </span>
              <span className={styles.rankingScore}>{row.score} pts</span>
            </div>
          ))}
        </div>

        <PopButtonLink
          href="/flash-pop"
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.action}
        >
          Volver al lobby
        </PopButtonLink>
        <PopButton variant="secondary" fullWidth className={styles.action} onClick={onReview}>
          Revisar respuesta
        </PopButton>
      </PopCard>
    </div>
  );
}

export function FlashPopPyramidGame({ challenge }: { challenge: PyramidChallenge }) {
  const scoredChallenge = useMemo(() => withPyramidScoring(challenge), [challenge]);
  const session = usePyramidSession(scoredChallenge, {
    storageNamespace: FLASH_POP_STORAGE_NAMESPACE,
    feedbackDuration: { correct: 1100, incorrect: 1800, unanswered: 1800 },
  });
  const currentLevel = session.currentLevel ?? challenge.levels[0];
  const currentLevelIndex = session.record?.currentLevelIndex ?? 0;

  if (
    challenge.id !== FLASH_POP_CHALLENGE_ID ||
    challenge.mode !== "pyramid" ||
    challenge.levels.length !== FLASH_POP_LEVEL_COUNT ||
    !currentLevel
  ) {
    return (
      <PopCanvas maxWidth="content">
        <PopCard>
          <h1>Reto no disponible</h1>
          <p>Este preview requiere los siete niveles de La Pirámide.</p>
          <PopButtonLink href="/flash-pop" className={styles.action}>
            Volver al lobby
          </PopButtonLink>
        </PopCard>
      </PopCanvas>
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
      <PopCanvas contentClassName={styles.screen}>
        <AnimatePresence mode="wait">
          {session.phase === "loading" ? (
            <motion.div
              key="loading"
              className={styles.briefing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Topbar />
              <PopCard className={styles.briefingCard}>
                <BoltIcon />
                <p>Preparando tu ascenso…</p>
              </PopCard>
            </motion.div>
          ) : null}
          {session.phase === "intro" || session.phase === "confirm" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro
                challenge={challenge}
                storageAvailable={session.storageAvailable}
                confirming={session.phase === "confirm"}
                onConfirm={session.showConfirmation}
                onCancel={session.hideConfirmation}
                onStart={session.start}
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
                onCodeAttempt={session.handleCodeAttempt}
                onTimedResponseStart={() => undefined}
                initialAnswer={session.initialAnswer}
                attemptCount={session.codeAttempts.length}
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
              <Result result={result} onReview={session.showReview} />
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
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </PopCanvas>
    </MotionConfig>
  );
}
