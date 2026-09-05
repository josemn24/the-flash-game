"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { QuestionScreen } from "@/components/QuestionScreen";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { SpeedBackground } from "@/components/SpeedBackground";
import {
  ArrowIcon,
  CheckIcon,
  CrossIcon,
  CrownIcon,
  EyeIcon,
  RotateIcon,
  WarningIcon,
} from "@/components/icons";
import { GameHeader, Chip, MotionButton } from "@/components/ui";
import { usePyramidSession } from "@/features/pyramid/usePyramidSession";
import { withPyramidScoring } from "@/lib/challengeScoring";
import type { PyramidAttemptOutcome } from "@/features/pyramid/pyramidAttempt";
import type { PyramidChallenge, PyramidLevel } from "@/types/game";
import styles from "@/components/pyramid/PyramidGame.module.css";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes} min ${rest} s` : `${rest} s`;
}

function PyramidMap({
  levels,
  cleared,
  currentIndex,
  outcome,
  compact = false,
}: {
  levels: PyramidLevel[];
  cleared: number;
  currentIndex?: number;
  outcome?: PyramidAttemptOutcome | null;
  compact?: boolean;
}) {
  return (
    <ol
      className={`${styles.pyramidMap} ${compact ? styles.pyramidMapCompact : ""}`}
      aria-label="Niveles de La Pirámide, desde la cima hasta la entrada"
    >
      {[...levels].reverse().map((level, reversedIndex) => {
        const index = levels.length - reversedIndex - 1;
        const state =
          index < cleared
            ? "cleared"
            : outcome === "failed" && index === currentIndex
              ? "failed"
              : outcome === "summit" && index === levels.length - 1
                ? "cleared"
                : index === currentIndex
                  ? "current"
                  : "locked";
        const width = 45 + ((levels.length - index - 1) / Math.max(1, levels.length - 1)) * 55;
        return (
          <li
            key={level.id}
            className={styles[`tier${state[0].toUpperCase()}${state.slice(1)}`]}
            style={{ width: `${width}%` }}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{level.label}</strong>
            {state === "cleared" && <CheckIcon className={styles.tierIcon} />}
            {state === "failed" && <CrossIcon className={styles.tierIcon} />}
          </li>
        );
      })}
    </ol>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <GameHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Chip>Modo Pirámide</Chip>}
      />
      {children}
    </motion.section>
  );
}

function PyramidIntro({
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
    <ScreenShell>
      <div className={styles.introGrid}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Desafío {String(challenge.number).padStart(2, "0")}</p>
          <h1>{challenge.title}</h1>
          <p className={styles.subtitle}>{challenge.subtitle}</p>
          <p className={styles.description}>{challenge.description}</p>

          <div className={styles.rules}>
            <div>
              <CrossIcon />
              <span>
                <strong>Un fallo termina el ascenso</strong>
                Solo una respuesta completamente correcta abre el siguiente nivel.
              </span>
            </div>
            <div>
              <CrownIcon />
              <span>
                <strong>Prototipo rejugable</strong>
                Puedes volver a intentarlo tantas veces como quieras.
              </span>
            </div>
          </div>

          {!storageAvailable && (
            <div className={styles.storageWarning} role="alert">
              <WarningIcon />
              El progreso de esta partida no sobrevivirá a una recarga, pero puedes jugarla.
            </div>
          )}

          <MotionButton
            className={styles.primaryAction}
            onClick={onConfirm}
            whileTap={{ scale: 0.98 }}
          >
            Preparar ascenso
            <ArrowIcon className="h-5 w-5" />
          </MotionButton>
        </div>

        <div className={styles.introPyramid}>
          <div className={styles.summitGlow} aria-hidden="true" />
          <PyramidMap levels={challenge.levels} cleared={0} />
          <p>Siete pruebas. 100 puntos. Repite cuando quieras.</p>
        </div>
      </div>

      {confirming && (
        <div className={styles.dialogBackdrop} role="presentation">
          <motion.div
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pyramid-confirm-title"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <WarningIcon className={styles.dialogIcon} />
            <h2 id="pyramid-confirm-title">¿Listo para ascender?</h2>
            <p>
              El reloj comenzará al aparecer el primer nivel. Si fallas, podrás revisar la solución
              y comenzar una nueva partida.
            </p>
            <MotionButton autoFocus onClick={onStart} whileTap={{ scale: 0.98 }}>
              Empezar partida
            </MotionButton>
            <MotionButton variant="secondary" onClick={onCancel} whileTap={{ scale: 0.98 }}>
              Todavía no
            </MotionButton>
          </motion.div>
        </div>
      )}
    </ScreenShell>
  );
}

function PyramidTransition({
  challenge,
  currentIndex,
  cleared,
  passed,
  outcome,
}: {
  challenge: PyramidChallenge;
  currentIndex: number;
  cleared: number;
  passed: boolean;
  outcome?: PyramidAttemptOutcome | null;
}) {
  const summit = outcome === "summit";
  return (
    <motion.section
      className={styles.transitionScreen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <div className={styles.transitionContent}>
        <PyramidMap
          levels={challenge.levels}
          cleared={cleared}
          currentIndex={currentIndex}
          outcome={outcome}
          compact
        />
        <motion.div
          className={`${styles.transitionMark} ${passed ? styles.transitionMarkSuccess : styles.transitionMarkFailure}`}
          initial={{ scale: 0.45, rotate: passed ? -12 : 12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
        >
          {summit ? <CrownIcon /> : passed ? <CheckIcon /> : <CrossIcon />}
        </motion.div>
        <p className={styles.eyebrow}>{challenge.levels[currentIndex]?.label}</p>
        <h1>
          {summit ? "Cima conquistada" : passed ? "Nivel superado" : "El ascenso termina aquí"}
        </h1>
        <p>
          {summit
            ? "Has resuelto los siete niveles de La Pirámide."
            : passed
              ? "La siguiente cámara se está abriendo."
              : "Puedes revisar el resultado o volver a intentarlo."}
        </p>
      </div>
    </motion.section>
  );
}

function PyramidBriefing({
  challenge,
  level,
  levelIndex,
  cleared,
  onStart,
}: {
  challenge: PyramidChallenge;
  level: PyramidLevel;
  levelIndex: number;
  cleared: number;
  onStart: () => void;
}) {
  const titleId = `pyramid-briefing-title-${level.id}`;
  const descriptionId = `pyramid-briefing-description-${level.id}`;

  return (
    <motion.section
      className={styles.briefingScreen}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-live="polite"
    >
      <div className={styles.briefingContent}>
        <PyramidMap levels={challenge.levels} cleared={cleared} currentIndex={levelIndex} compact />
        <div className={styles.briefingCard}>
          <h1 id={titleId}>{level.briefing.title}</h1>
          <p className={styles.briefingFormat}>{level.briefing.format}</p>
          <p id={descriptionId} className={styles.briefingDescription}>
            {level.briefing.description}
          </p>

          <div className={styles.briefingStats} aria-label="Condiciones del nivel">
            <div>
              <strong>{formatTime(level.question.timeLimit)}</strong>
              <span>tiempo</span>
            </div>
            <div>
              <strong>{level.question.points}</strong>
              <span>puntos máximos</span>
            </div>
          </div>

          <MotionButton
            autoFocus
            className={styles.briefingAction}
            onClick={onStart}
            whileTap={{ scale: 0.98 }}
          >
            Empezar nivel
            <ArrowIcon className="h-5 w-5" />
          </MotionButton>
        </div>
      </div>
    </motion.section>
  );
}

function PyramidResults({
  challenge,
  levelsCleared,
  score,
  timeUsed,
  outcome,
  storageAvailable,
  onReview,
  onReplay,
}: {
  challenge: PyramidChallenge;
  levelsCleared: number;
  score: number;
  timeUsed: number;
  outcome: PyramidAttemptOutcome;
  storageAvailable: boolean;
  onReview: () => void;
  onReplay: () => void;
}) {
  const summit = outcome === "summit";
  return (
    <ScreenShell>
      <div className={styles.resultsGrid}>
        <div className={styles.resultPyramid}>
          <PyramidMap
            levels={challenge.levels}
            cleared={levelsCleared}
            currentIndex={summit ? undefined : levelsCleared}
            outcome={outcome}
          />
        </div>
        <div className={styles.resultCard}>
          <Chip>{summit ? "Cima conquistada" : "Partida terminada"}</Chip>
          <h1>{summit ? "Has llegado a lo más alto." : "Ascenso terminado."}</h1>
          <p className={styles.resultLead}>
            Has superado <strong>{levelsCleared}</strong> de los {challenge.levels.length} niveles.
          </p>
          <div className={styles.resultStats}>
            <div>
              <strong>{score}</strong>
              <span>puntos</span>
            </div>
            <div>
              <strong>{levelsCleared}/7</strong>
              <span>niveles</span>
            </div>
            <div>
              <strong>{formatTime(timeUsed)}</strong>
              <span>tiempo</span>
            </div>
          </div>

          <div className={styles.resultActions}>
            <MotionButton onClick={onReview} whileTap={{ scale: 0.98 }}>
              <EyeIcon className="h-5 w-5" />
              Ver soluciones
            </MotionButton>
            <MotionButton variant="secondary" onClick={onReplay} whileTap={{ scale: 0.98 }}>
              <RotateIcon className="h-5 w-5" />
              Volver a jugar
            </MotionButton>
          </div>
          {!storageAvailable && (
            <p className={styles.persistenceNotice}>Esta partida no se ha guardado localmente.</p>
          )}
          <Link className={styles.backLink} href="/">
            Volver a los desafíos
          </Link>
        </div>
      </div>
    </ScreenShell>
  );
}

export function PyramidGameApp({ challenge }: { challenge: PyramidChallenge }) {
  const scoredChallenge = useMemo(() => withPyramidScoring(challenge), [challenge]);
  const session = usePyramidSession(scoredChallenge);
  const currentIndex = session.record?.currentLevelIndex ?? 0;
  const latestPassed = Boolean(session.latestResult?.isCorrect);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-brand)] selection:text-[var(--color-text-on-brand)]">
        <SpeedBackground />
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {session.phase === "loading" && (
              <motion.div
                key="loading"
                className={styles.loading}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <CrownIcon />
                <span>Preparando La Pirámide…</span>
              </motion.div>
            )}
            {(session.phase === "intro" || session.phase === "confirm") && (
              <PyramidIntro
                key="intro"
                challenge={scoredChallenge}
                storageAvailable={session.storageAvailable}
                confirming={session.phase === "confirm"}
                onConfirm={session.showConfirmation}
                onCancel={session.hideConfirmation}
                onStart={session.start}
              />
            )}
            {session.phase === "briefing" && session.currentLevel && session.record && (
              <PyramidBriefing
                key={`briefing-${currentIndex}`}
                challenge={scoredChallenge}
                level={session.currentLevel}
                levelIndex={currentIndex}
                cleared={session.levelsCleared}
                onStart={session.beginLevel}
              />
            )}
            {session.phase === "playing" && session.currentLevel && (
              <QuestionScreen
                key={session.currentLevel.question.id}
                question={session.currentLevel.question}
                challengeTitle={scoredChallenge.title}
                questionNumber={currentIndex + 1}
                totalQuestions={scoredChallenge.levels.length}
                progressVariant="pyramid"
                locked={session.locked}
                deadlineAt={session.deadlineAt}
                initialAnswer={session.initialAnswer}
                onReady={session.armCurrentLevel}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                codeAttemptCount={session.codeAttempts.length}
                onCodeAttempt={session.handleCodeAttempt}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={() => {}}
                onTimedResponseStart={() => {}}
              />
            )}
            {session.phase === "transition" && session.record && (
              <PyramidTransition
                key={`transition-${currentIndex}`}
                challenge={scoredChallenge}
                currentIndex={currentIndex}
                cleared={session.levelsCleared}
                passed={latestPassed}
                outcome={session.record.outcome}
              />
            )}
            {session.phase === "results" && session.summary && session.record?.outcome && (
              <PyramidResults
                key="results"
                challenge={scoredChallenge}
                levelsCleared={session.summary.levelsCleared}
                score={session.summary.score}
                timeUsed={session.summary.timeUsed}
                outcome={session.record.outcome}
                storageAvailable={session.storageAvailable}
                onReview={session.showReview}
                onReplay={session.restart}
              />
            )}
            {session.phase === "review" && session.record && (
              <ReviewAnswers
                key="review"
                challenge={scoredChallenge}
                results={session.record.results}
                onBack={session.showResults}
                onReplay={session.restart}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  );
}
