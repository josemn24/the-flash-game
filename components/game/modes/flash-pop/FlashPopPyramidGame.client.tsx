"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowIcon, BoltIcon, CheckIcon } from "@/components/ui";
import { Avatar, Button, ButtonLink, Canvas, Card, Chip, GameHeader, Timer } from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import { withPyramidScoring } from "@/lib/challengeScoring";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { FlashPopReview } from "@/components/game/modes/flash-pop/FlashPopReview";
import { getFlashPopResult, type FlashPopResult } from "@/features/flash-pop/demoSocial";
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
  confirming,
  onConfirm,
  onCancel,
  onStart,
}: {
  challenge: PyramidChallenge;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <div className={styles.intro}>
      <Topbar />
      <Card as="section" className={styles.introCard} aria-labelledby="flash-pop-intro-title">
        <div className={styles.introIllustration} aria-hidden="true" />
        <Chip tone="social">Reto de hoy · Pirámide</Chip>
        <h1 id="flash-pop-intro-title">{challenge.title}</h1>
        <p className={styles.introLead}>{challenge.subtitle}</p>

        <div className={styles.rules}>
          <div className={styles.rule}>
            <strong>{challenge.levels.length} niveles</strong>
            <span>Una secuencia de formatos para llegar a la cima.</span>
          </div>
          <div className={styles.rule}>
            <strong>Juega a tu ritmo</strong>
            <span>Responde rápido, revisa tu ascenso y vuelve a intentarlo.</span>
          </div>
        </div>

        <Button
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.action}
          onClick={onConfirm}
        >
          Empezar partida
        </Button>
        <p className={styles.attemptNote}>
          {challenge.levels.length} niveles · {formatTime(getChallengeTimeLimit(challenge))} · Hasta
          +120 ⚡
        </p>
      </Card>

      {confirming ? (
        <div
          className={styles.confirmCard}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <h1 id="confirm-title">¿Listo para subir?</h1>
          <p>El reloj comienza al mostrar la pregunta. Podrás volver a jugar cuando termines.</p>
          <Button size="hero" fullWidth trailingIcon={<ArrowIcon />} onClick={onStart}>
            Confirmar partida
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>
            Todavía no
          </Button>
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
      <Card as="section" className={styles.briefingCard} aria-labelledby="briefing-title">
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
  onReview,
  onReplay,
}: {
  challenge: PyramidChallenge;
  result: FlashPopResult;
  onReview: () => void;
  onReplay: () => void;
}) {
  const summit = result.levelsCleared >= challenge.levels.length;
  return (
    <div className={styles.result}>
      <Topbar />
      <Card as="section" className={styles.resultCard} aria-labelledby="result-title">
        <Chip variant="reward">Resultado</Chip>
        <p className={styles.resultChallenge}>{challenge.title}</p>
        <h1 id="result-title">{summit ? "Cima conquistada" : "Ascenso terminado"}</h1>
        <p className={styles.resultSubtitle}>{challenge.subtitle}</p>
        <div className={styles.resultScore}>{result.score}</div>
        <p className={styles.resultScoreLabel}>puntos de partida</p>
        <div className={styles.resultMeta}>
          <div className={styles.resultStat}>
            <strong>
              {result.levelsCleared} / {challenge.levels.length}
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
            Tu grupo
            <span className={styles.metaLabel}>
              · {result.socialSource === "demo" ? "Demo" : "En directo"}
            </span>
          </h2>
          {result.peers.map((row) => (
            <div
              className={`${styles.rankingRow} ${row.player.id === "javi" ? styles.current : ""}`}
              key={row.player.id}
            >
              <span className={styles.rankingPosition}>{row.rank}.</span>
              <Avatar
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

        <ButtonLink
          href="/"
          size="hero"
          fullWidth
          trailingIcon={<ArrowIcon />}
          className={styles.action}
        >
          Volver al lobby
        </ButtonLink>
        <Button variant="secondary" fullWidth className={styles.action} onClick={onReview}>
          Revisar respuesta
        </Button>
        <Button variant="secondary" fullWidth className={styles.action} onClick={onReplay}>
          Jugar de nuevo
        </Button>
      </Card>
    </div>
  );
}

export function FlashPopPyramidGame({ challenge }: { challenge: PyramidChallenge }) {
  const scoredChallenge = useMemo(() => withPyramidScoring(challenge), [challenge]);
  const session = usePyramidSession(scoredChallenge, {
    persistence: "memory",
    feedbackDuration: { correct: 1100, incorrect: 1800, unanswered: 1800 },
  });
  const currentLevel = session.currentLevel ?? challenge.levels[0];
  const currentLevelIndex = session.record?.currentLevelIndex ?? 0;

  if (challenge.mode !== "pyramid" || challenge.levels.length === 0 || !currentLevel) {
    return (
      <Canvas maxWidth="content">
        <Card>
          <h1>Reto no disponible</h1>
          <p>Este reto no tiene niveles configurados.</p>
          <ButtonLink href="/" className={styles.action}>
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
      <Canvas contentClassName={styles.screen}>
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
          {session.phase === "intro" || session.phase === "confirm" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Intro
                challenge={challenge}
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
                onReview={session.showReview}
                onReplay={session.restart}
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
