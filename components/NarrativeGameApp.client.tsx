"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { FieldNotebook } from "@/components/FieldNotebook.client";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  NotebookIcon,
  RotateIcon,
} from "@/components/icons";
import { Logo } from "@/components/Logo";
import { QuestionScreen } from "@/components/QuestionScreen";
import { QuestionTransition } from "@/components/QuestionTransition";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { MotionButton } from "@/components/ui/MotionButton.client";
import { useNarrativeSession } from "@/features/narrative/useNarrativeSession";
import styles from "@/components/NarrativeGame.module.css";
import type {
  AnswerResult,
  NarrativeChallenge,
  NarrativeNotebookEntry,
  NarrativeScene,
  NarrativeTextBlock,
} from "@/types/game";

function NarrativeBlocks({
  blocks,
  className,
}: {
  blocks: NarrativeTextBlock[];
  className?: string;
}) {
  if (blocks.length === 0) return null;

  return (
    <div className={`${styles.sceneBlocks} ${className ?? ""}`}>
      {blocks.map((block, index) =>
        block.type === "dialogue" ? (
          <p className={styles.sceneDialogue} key={`${block.type}-${index}`}>
            <span className={styles.speakerLabel}>{block.speaker}: </span>
            <span aria-hidden="true">—</span>
            {block.text}
          </p>
        ) : (
          <p className={styles.sceneParagraph} key={`${block.type}-${index}`}>
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}

function NotebookButton({ entryCount, onOpen }: { entryCount: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.notebookTrigger}
      onClick={onOpen}
      aria-label={`Abrir cuaderno de campo, ${entryCount} ${entryCount === 1 ? "entrada" : "entradas"}`}
    >
      <NotebookIcon className="h-4 w-4" />
      <span>Cuaderno</span>
      <strong>{entryCount}</strong>
    </button>
  );
}

function NarrativeIntro({
  challenge,
  questionCount,
  onStart,
}: {
  challenge: NarrativeChallenge;
  questionCount: number;
  onStart: () => void;
}) {
  return (
    <motion.section
      className={styles.fullScreen}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
    >
      <AppHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Badge>Movimientos I–III</Badge>}
      />

      <div className={styles.introContent}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Narrativa competitiva</p>
          <h1>{challenge.title}</h1>
          <p className={styles.subtitle}>{challenge.subtitle}</p>
          <p className={styles.description}>{challenge.description}</p>
        </div>

        <div className={styles.introPanel}>
          <div className={styles.introStats}>
            <div>
              <strong>{questionCount}</strong>
              <span>Pruebas</span>
            </div>
            <div>
              <strong>{challenge.maxScore}</strong>
              <span>Puntos</span>
            </div>
            <div>
              <strong>≈ 6–7</strong>
              <span>Minutos</span>
            </div>
          </div>
          <ul className={styles.introRules}>
            <li>Las escenas y transiciones no consumen tiempo competitivo.</li>
            <li>El cuaderno registra la observación aunque falles la prueba.</li>
          </ul>
          <MotionButton size="hero" onClick={onStart} whileTap={{ scale: 0.985 }}>
            Comenzar misión
            <ArrowIcon className="h-5 w-5" />
          </MotionButton>
        </div>
      </div>
    </motion.section>
  );
}

function NarrativeSceneScreen({
  scene,
  reactionBlocks,
  entryCount,
  onContinue,
  onOpenNotebook,
}: {
  scene: NarrativeScene;
  reactionBlocks: NarrativeTextBlock[];
  entryCount: number;
  onContinue: () => void;
  onOpenNotebook: () => void;
}) {
  return (
    <motion.section
      className={styles.fullScreen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AppHeader
        left={<Logo />}
        right={<NotebookButton entryCount={entryCount} onOpen={onOpenNotebook} />}
      />
      <div className={styles.sceneContent}>
        <article className={styles.sceneArticle}>
          <p className={styles.eyebrow}>{scene.eyebrow}</p>
          {scene.title && <h1>{scene.title}</h1>}
          <NarrativeBlocks blocks={reactionBlocks} className={styles.sceneReaction} />
          {scene.id === "scene-epilogue" && reactionBlocks.length > 0 && (
            <div className={styles.trajectoryResolution} aria-label="Resolución de la trayectoria">
              <p className={styles.eyebrow}>Trayectoria resuelta</p>
              <strong>270° − 30° = 240° · C4 → Ruta B</strong>
              <p>
                A ignora la calibración; C invierte el rumbo; D parte de B4. Solo B conserva el
                origen C4 y aplica la corrección.
              </p>
            </div>
          )}
          <NarrativeBlocks blocks={scene.blocks} />
          <MotionButton
            className={styles.continueButton}
            onClick={onContinue}
            whileTap={{ scale: 0.985 }}
          >
            Continuar
            <ArrowIcon className="h-5 w-5" />
          </MotionButton>
          <p className={styles.untimedLabel}>
            <ClockIcon className="h-4 w-4" /> Sin tiempo competitivo
          </p>
        </article>
      </div>
    </motion.section>
  );
}

function formatTime(seconds: number) {
  return `${seconds.toFixed(1)} s`;
}

function NarrativeResult({
  challenge,
  results,
  entries,
  score,
  onReview,
  onReplay,
  onOpenNotebook,
}: {
  challenge: NarrativeChallenge;
  results: AnswerResult[];
  entries: NarrativeNotebookEntry[];
  score: number;
  onReview: () => void;
  onReplay: () => void;
  onOpenNotebook: () => void;
}) {
  const correct = results.filter((result) => result.status === "correct").length;
  const partial = results.filter((result) => result.status === "partial").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const incorrect = results.length - correct - partial - unanswered;
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);

  return (
    <motion.section
      className={styles.fullScreen}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <AppHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Badge>Misión completada</Badge>}
      />
      <div className={styles.resultGrid}>
        <div className={styles.resultScore}>
          <p className={styles.eyebrow}>Movimientos I–III completados</p>
          <h1>La jornada queda registrada.</h1>
          <div className={styles.scoreValue}>
            <strong>{score}</strong>
            <span>/ {challenge.maxScore} puntos</span>
          </div>
          <div className={styles.resultActions}>
            <MotionButton onClick={onReview} whileTap={{ scale: 0.985 }}>
              <NotebookIcon className="h-5 w-5" /> Revisar respuestas
            </MotionButton>
            <MotionButton variant="secondary" onClick={onReplay} whileTap={{ scale: 0.985 }}>
              <RotateIcon className="h-5 w-5" /> Volver a jugar
            </MotionButton>
            <Link className={styles.backLink} href="/">
              Volver a desafíos
            </Link>
          </div>
        </div>

        <div className={styles.resultDetails}>
          <div className={styles.resultStats}>
            <div>
              <CheckIcon className="h-5 w-5" />
              <strong>{correct}</strong>
              <span>Correctas</span>
            </div>
            <div>
              <BoltIcon className="h-5 w-5" />
              <strong>{partial}</strong>
              <span>Parciales</span>
            </div>
            <div>
              <CrossIcon className="h-5 w-5" />
              <strong>{incorrect}</strong>
              <span>Falladas</span>
            </div>
            <div>
              <ClockIcon className="h-5 w-5" />
              <strong>{unanswered}</strong>
              <span>Sin respuesta</span>
            </div>
          </div>
          <ol className={styles.answerStates} aria-label="Estado de las pruebas">
            {results.map((result, index) => {
              const label =
                result.status === "correct"
                  ? "Correcta"
                  : result.status === "partial"
                    ? "Parcial"
                    : result.status === "unanswered"
                      ? "Tiempo agotado"
                      : "Fallada";
              return (
                <li key={result.questionId} data-status={result.status}>
                  <span>Prueba {index + 1}</span>
                  <strong>{label}</strong>
                </li>
              );
            })}
          </ol>
          <button type="button" className={styles.resultNotebook} onClick={onOpenNotebook}>
            <NotebookIcon className="h-6 w-6" />
            <span>
              <small>Cuaderno actualizado</small>
              <strong>{entries.length} observaciones registradas</strong>
            </span>
            <ArrowIcon className="ml-auto h-5 w-5" />
          </button>
          <div className={styles.timeSummary}>
            <span>Tiempo competitivo</span>
            <strong>{formatTime(totalTime)}</strong>
          </div>
          <p className={styles.resultNotice}>
            Puntuación individual de la misión. La señal y la trayectoria permanecen como
            observaciones, no como una explicación cerrada.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function PolarBackground() {
  return (
    <div className={styles.polarBackground} aria-hidden="true">
      <div className={styles.aurora} />
      <div className={styles.horizon} />
      <div className={styles.snow} />
    </div>
  );
}

export function NarrativeGameApp({ challenge }: { challenge: NarrativeChallenge }) {
  const session = useNarrativeSession(challenge);
  const transitionCopy = session.lastTimedOut
    ? {
        title: "Tiempo agotado",
        body: "El cuaderno conserva la observación. La jornada continúa.",
        tone: "danger" as const,
      }
    : {
        title: "Observación registrada",
        body: "Actualizando el cuaderno de campo.",
        tone: "success" as const,
      };

  return (
    <MotionConfig reducedMotion="user">
      <main
        className={`${styles.gameRoot} ${session.phase === "playing" ? styles.questionPhase : ""}`}
      >
        <PolarBackground />
        <div className={styles.gameContent}>
          <AnimatePresence mode="wait">
            {session.phase === "intro" && (
              <NarrativeIntro
                key="narrative-intro"
                challenge={challenge}
                questionCount={session.totalQuestions}
                onStart={session.start}
              />
            )}
            {session.phase === "scene" && session.currentStep?.type === "scene" && (
              <NarrativeSceneScreen
                key={session.currentStep.scene.id}
                scene={session.currentStep.scene}
                reactionBlocks={session.reactionBlocks}
                entryCount={session.unlockedEntries.length}
                onContinue={session.continueScene}
                onOpenNotebook={session.openNotebook}
              />
            )}
            {session.phase === "playing" && session.currentStep?.type === "question" && (
              <QuestionScreen
                key={session.currentStep.question.id}
                question={session.currentStep.question}
                challengeTitle={challenge.title}
                questionNumber={session.questionNumber}
                totalQuestions={session.totalQuestions}
                locked={session.locked}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                codeAttemptCount={0}
                onCodeAttempt={() => false}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onProgressiveClueReveal={() => undefined}
                onTimedResponseStart={session.handleTimedResponseStart}
                notebook={{
                  entryCount: session.unlockedEntries.length,
                  onOpen: session.openNotebook,
                }}
                presentation={{ splitPrompt: true, prominentMedia: true }}
              />
            )}
            {session.phase === "transition" && (
              <QuestionTransition
                key={`narrative-transition-${session.stepIndex}`}
                timedOut={session.lastTimedOut}
                isLast={session.results.length === session.totalQuestions}
                customCopy={transitionCopy}
              />
            )}
            {session.phase === "results" && (
              <NarrativeResult
                key="narrative-results"
                challenge={challenge}
                results={session.results}
                entries={session.unlockedEntries}
                score={session.score}
                onReview={session.showReview}
                onReplay={session.replay}
                onOpenNotebook={session.openNotebook}
              />
            )}
            {session.phase === "review" && (
              <ReviewAnswers
                key="narrative-review"
                challenge={challenge}
                results={session.results}
                onBack={session.showResults}
                onReplay={session.replay}
                notebook={{
                  entryCount: session.unlockedEntries.length,
                  onOpen: session.openNotebook,
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <FieldNotebook
          open={session.notebookOpen}
          entries={session.unlockedEntries}
          onClose={session.closeNotebook}
        />
      </main>
    </MotionConfig>
  );
}
