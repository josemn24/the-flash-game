"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
import { QuestionMedia } from "@/components/QuestionMedia";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { QuestionTransition } from "@/components/QuestionTransition";
import { GameHeader, Chip, MotionButton, Timer } from "@/components/ui";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { useNarrativeSession } from "@/features/narrative/useNarrativeSession";
import styles from "@/components/NarrativeGame.module.css";
import type {
  AnswerResult,
  AnswerValue,
  NarrativeChallenge,
  NarrativeNotebookEntry,
  NarrativeScene,
  NarrativeTextBlock,
  Question,
} from "@/types/game";

function NarrativeSceneChrome({
  pageNumber,
  pageCount,
  entryCount,
  onOpenNotebook,
}: {
  pageNumber: number;
  pageCount: number;
  entryCount: number;
  onOpenNotebook: () => void;
}) {
  return (
    <div className={styles.storyChrome}>
      <span className={styles.storyFolio} aria-label={`Página ${pageNumber} de ${pageCount}`}>
        {String(pageNumber).padStart(2, "0")} / {pageCount}
      </span>
      <NotebookButton entryCount={entryCount} onOpen={onOpenNotebook} compact />
    </div>
  );
}

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
        ) : block.type === "emphasis" ? (
          <p className={styles.sceneEmphasis} key={`${block.type}-${index}`}>
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

function NotebookButton({
  entryCount,
  onOpen,
  compact = false,
}: {
  entryCount: number;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.notebookTrigger} ${compact ? styles.notebookTriggerCompact : ""}`}
      onClick={onOpen}
      aria-label={`Abrir registro de evidencias, ${entryCount} ${entryCount === 1 ? "entrada" : "entradas"}`}
    >
      <NotebookIcon className="h-4 w-4" />
      <span>{compact ? <span className="sr-only">Registro</span> : "Registro"}</span>
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
      <GameHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Chip>Cuento en tres capítulos</Chip>}
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
              <strong>≈ 9–11</strong>
              <span>Minutos</span>
            </div>
          </div>
          <ul className={styles.introRules}>
            <li>El registro conserva la evidencia aunque falles la prueba.</li>
            <li>Lee cada página antes de intervenir en los registros.</li>
          </ul>
          <MotionButton size="hero" onClick={onStart} whileTap={{ scale: 0.985 }}>
            Abrir el relato
            <ArrowIcon className="h-5 w-5" />
          </MotionButton>
        </div>
      </div>
    </motion.section>
  );
}

function NarrativeSceneScreen({
  scene,
  pageNumber,
  pageCount,
  reactionBlocks,
  entryCount,
  onContinue,
  onOpenNotebook,
}: {
  scene: NarrativeScene;
  pageNumber: number;
  pageCount: number;
  reactionBlocks: NarrativeTextBlock[];
  entryCount: number;
  onContinue: () => void;
  onOpenNotebook: () => void;
}) {
  const presentation = scene.presentation ?? "standard";
  const presentationClass = {
    standard: styles.storyPageSplit,
    "chapter-opening": styles.storyPageChapter,
    "full-bleed": styles.storyPageFullBleed,
    split: styles.storyPageSplit,
    "text-led": styles.storyPageText,
    artifact: styles.storyPageArtifact,
    blackout: styles.storyPageText,
  }[presentation];

  return (
    <motion.section
      className={styles.storyScreen}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
    >
      <NarrativeSceneChrome
        pageNumber={pageNumber}
        pageCount={pageCount}
        entryCount={entryCount}
        onOpenNotebook={onOpenNotebook}
      />
      <div className={`${styles.storyPage} ${presentationClass}`}>
        {scene.media?.type === "image" && (
          <div className={styles.storyVisual}>
            <Image
              src={scene.media.src}
              alt={scene.media.alt}
              fill
              sizes="(max-width: 799px) 100vw, 68vw"
              className={
                scene.media.fit === "contain" ? styles.storyImageContain : styles.storyImage
              }
              style={{ objectPosition: scene.media.position }}
              priority={scene.id === "scene-prologue-recording"}
            />
            <div className={styles.visualShade} aria-hidden="true" />
            {scene.caption && <p className={styles.storyCaption}>{scene.caption}</p>}
            {scene.id === "scene-prologue-recording" && (
              <div className={styles.tapeSignal} aria-label="Siseo de una grabación antigua">
                <span>REC · ARCHIVO</span>
                {Array.from({ length: 12 }, (_, index) => (
                  <i key={index} />
                ))}
              </div>
            )}
          </div>
        )}
        <article className={styles.storyArticle}>
          {scene.eyebrow && <p className={styles.eyebrow}>{scene.eyebrow}</p>}
          {scene.title && <h1>{scene.title}</h1>}
          <NarrativeBlocks blocks={reactionBlocks} className={styles.sceneReaction} />
          <NarrativeBlocks blocks={scene.blocks} />
        </article>
        <MotionButton
          variant="secondary"
          className={styles.continueButton}
          onClick={onContinue}
          whileTap={{ scale: 0.985 }}
        >
          {scene.advanceLabel ?? "Seguir"}
          <ArrowIcon className="h-4 w-4" />
        </MotionButton>
      </div>
    </motion.section>
  );
}

function NarrativeQuestionScreen({
  question,
  questionNumber,
  totalQuestions,
  locked,
  entryCount,
  onOpenNotebook,
  onSubmit,
  onTimeUp,
  onProgress,
  onIncorrectAttempt,
  onTimedResponseStart,
}: {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  locked: boolean;
  entryCount: number;
  onOpenNotebook: () => void;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onTimedResponseStart: () => void;
}) {
  const hasDelayedStart = question.type === "progressive-image";
  const [timedResponseStarted, setTimedResponseStarted] = useState(!hasDelayedStart);
  const startTimedResponse = () => {
    setTimedResponseStarted(true);
    onTimedResponseStart();
  };

  return (
    <motion.section
      className={styles.storyScreen}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
    >
      <header className={styles.questionHud}>
        <div>
          {!hasDelayedStart || timedResponseStarted ? (
            <Timer
              duration={question.timeLimit}
              active={!locked && timedResponseStarted}
              onTimeUp={onTimeUp}
              resetKey={question.id}
              size="compact"
            />
          ) : null}
        </div>
        <NotebookButton entryCount={entryCount} onOpen={onOpenNotebook} compact />
      </header>
      <div className={`${styles.storyPage} ${styles.questionPage}`}>
        <article className={styles.questionArticle}>
          <div className={styles.questionMeta}>
            <span>
              Prueba {questionNumber} de {totalQuestions}
            </span>
          </div>
          <h1>{question.question}</h1>
          {question.questionContext && (
            <p className={styles.questionContext}>{question.questionContext}</p>
          )}
          {"media" in question && question.media && (
            <div className={styles.questionMedia}>
              <QuestionMedia media={question.media} prominent />
            </div>
          )}
          <QuestionInput
            question={question}
            locked={locked}
            onSubmit={onSubmit}
            codeAttemptCount={0}
            onCodeAttempt={() => false}
            onProgress={onProgress}
            onIncorrectAttempt={onIncorrectAttempt}
            onProgressiveClueReveal={() => undefined}
            onTimedResponseStart={startTimedResponse}
          />
        </article>
      </div>
    </motion.section>
  );
}

function NarrativeEpilogueScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.section
      className={styles.epilogueScreen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-labelledby="narrative-epilogue-title"
    >
      <div className={styles.epilogueContent}>
        <motion.h1
          id="narrative-epilogue-title"
          className={styles.epilogueTitle}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          BUT WHY?
        </motion.h1>
        <MotionButton
          variant="secondary"
          className={styles.epilogueContinue}
          onClick={onContinue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1, duration: 0.45 }}
          whileTap={{ scale: 0.985 }}
        >
          Ver resultado
          <ArrowIcon className="h-5 w-5" />
        </MotionButton>
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
      <GameHeader
        left={
          <Link href="/" aria-label="Volver a los desafíos">
            <Logo />
          </Link>
        }
        right={<Chip>Misión completada</Chip>}
      />
      <div className={styles.resultGrid}>
        <div className={styles.resultScore}>
          <p className={styles.eyebrow}>Tres capítulos completados</p>
          <h1>El recorrido queda registrado.</h1>
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
              <small>Registro de evidencias</small>
              <strong>{entries.length} entradas conservadas</strong>
            </span>
            <ArrowIcon className="ml-auto h-5 w-5" />
          </button>
          <div className={styles.timeSummary}>
            <span>Tiempo competitivo</span>
            <strong>{formatTime(totalTime)}</strong>
          </div>
          <p className={styles.resultNotice}>
            La trayectoria está documentada. Su causa permanece fuera del registro.
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
  const pageCount = 1 + challenge.beats.reduce((total, beat) => total + beat.steps.length, 0);
  const isBlackoutScene =
    session.phase === "scene" &&
    session.currentStep?.type === "scene" &&
    session.currentStep.scene.presentation === "blackout";

  return (
    <MotionConfig reducedMotion="user">
      <main
        className={`${styles.gameRoot} ${session.phase === "playing" ? styles.questionPhase : ""} ${isBlackoutScene ? styles.blackoutPhase : ""}`}
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
            {session.phase === "scene" &&
              session.currentStep?.type === "scene" &&
              (isBlackoutScene ? (
                <NarrativeEpilogueScreen
                  key={session.currentStep.scene.id}
                  onContinue={session.continueScene}
                />
              ) : (
                <NarrativeSceneScreen
                  key={session.currentStep.scene.id}
                  scene={session.currentStep.scene}
                  pageNumber={session.stepIndex + 1}
                  pageCount={pageCount}
                  reactionBlocks={session.reactionBlocks}
                  entryCount={session.unlockedEntries.length}
                  onContinue={session.continueScene}
                  onOpenNotebook={session.openNotebook}
                />
              ))}
            {session.phase === "playing" && session.currentStep?.type === "question" && (
              <NarrativeQuestionScreen
                key={session.currentStep.question.id}
                question={session.currentStep.question}
                questionNumber={session.questionNumber}
                totalQuestions={session.totalQuestions}
                locked={session.locked}
                onSubmit={(answer) => session.submitAnswer(answer)}
                onTimeUp={session.handleTimeUp}
                onProgress={session.handleAnswerProgress}
                onIncorrectAttempt={session.handleIncorrectAttempt}
                onTimedResponseStart={session.handleTimedResponseStart}
                entryCount={session.unlockedEntries.length}
                onOpenNotebook={session.openNotebook}
              />
            )}
            {session.phase === "transition" && (
              <QuestionTransition
                key={`narrative-transition-${session.stepIndex}`}
                timedOut={session.lastTimedOut}
                isLast={false}
                customCopy={
                  session.lastTimedOut
                    ? {
                        title: "Tiempo agotado",
                        body: "La evidencia queda anotada. La siguiente escena está lista.",
                        tone: "danger",
                      }
                    : {
                        title: "Registro actualizado",
                        body: "La evidencia queda anotada. La siguiente escena está lista.",
                        tone: "success",
                      }
                }
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
