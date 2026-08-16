"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
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
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionMedia } from "@/components/QuestionMedia";
import { ReviewAnswers } from "@/components/ReviewAnswers";
import { Timer } from "@/components/Timer";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { MotionButton } from "@/components/ui/MotionButton.client";
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

function getChapterTitle(challenge: NarrativeChallenge, stepIndex: number) {
  if (stepIndex <= 0) return challenge.beats[0]?.title ?? "Prólogo";
  let cursor = 1;
  for (const beat of challenge.beats) {
    if (stepIndex < cursor + beat.steps.length) return beat.title;
    cursor += beat.steps.length;
  }
  return challenge.beats.at(-1)?.title ?? "Desenlace";
}

function NarrativePageHeader({
  chapter,
  pageNumber,
  pageCount,
  entryCount,
  onOpenNotebook,
  timer,
}: {
  chapter: string;
  pageNumber: number;
  pageCount: number;
  entryCount: number;
  onOpenNotebook: () => void;
  timer?: ReactNode;
}) {
  return (
    <AppHeader
      className={styles.pageHeader}
      left={
        <div className={styles.pageIdentity}>
          <Logo />
          <span>{chapter}</span>
          <small>
            Página {pageNumber} / {pageCount}
          </small>
        </div>
      }
      right={
        <div className={styles.pageActions}>
          {timer}
          <NotebookButton entryCount={entryCount} onOpen={onOpenNotebook} />
        </div>
      }
    />
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
      aria-label={`Abrir registro de evidencias, ${entryCount} ${entryCount === 1 ? "entrada" : "entradas"}`}
    >
      <NotebookIcon className="h-4 w-4" />
      <span>Registro</span>
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
        right={<Badge>Cuento en tres capítulos</Badge>}
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
              <strong>≈ 7–9</strong>
              <span>Minutos</span>
            </div>
          </div>
          <ul className={styles.introRules}>
            <li>Las escenas y transiciones no consumen tiempo competitivo.</li>
            <li>El registro conserva la evidencia aunque falles la prueba.</li>
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
  chapter,
  pageNumber,
  pageCount,
  reactionBlocks,
  entryCount,
  onContinue,
  onOpenNotebook,
}: {
  scene: NarrativeScene;
  chapter: string;
  pageNumber: number;
  pageCount: number;
  reactionBlocks: NarrativeTextBlock[];
  entryCount: number;
  onContinue: () => void;
  onOpenNotebook: () => void;
}) {
  return (
    <motion.section
      className={styles.storyScreen}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
    >
      <NarrativePageHeader
        chapter={chapter}
        pageNumber={pageNumber}
        pageCount={pageCount}
        entryCount={entryCount}
        onOpenNotebook={onOpenNotebook}
      />
      <div className={styles.storyPage}>
        <div className={styles.storyVisual}>
          {scene.media?.type === "image" && (
            <Image
              src={scene.media.src}
              alt={scene.media.alt}
              fill
              sizes="(max-width: 799px) 100vw, 52vw"
              className={
                scene.media.fit === "contain" ? styles.storyImageContain : styles.storyImage
              }
              style={{ objectPosition: scene.media.position }}
              priority={scene.id === "scene-prologue"}
            />
          )}
          <div className={styles.visualShade} aria-hidden="true" />
          {scene.id === "scene-prologue" && (
            <div className={styles.tapeSignal} aria-label="Siseo de una grabación antigua">
              <span>REC · ARCHIVO</span>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <article className={styles.storyArticle}>
          <p className={styles.eyebrow}>{scene.eyebrow}</p>
          {scene.title && <h1>{scene.title}</h1>}
          <NarrativeBlocks blocks={reactionBlocks} className={styles.sceneReaction} />
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

function NarrativeQuestionScreen({
  question,
  chapter,
  pageNumber,
  pageCount,
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
  chapter: string;
  pageNumber: number;
  pageCount: number;
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
  const chapterImage =
    chapter === "Mantenerse fuera"
      ? "/visuals/p17/camp-corridor.jpg"
      : chapter === "La línea completa"
        ? "/visuals/p17/final-plain.jpg"
        : "/visuals/p17/colony-panorama.jpg";
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
      <NarrativePageHeader
        chapter={chapter}
        pageNumber={pageNumber}
        pageCount={pageCount}
        entryCount={entryCount}
        onOpenNotebook={onOpenNotebook}
        timer={
          !hasDelayedStart || timedResponseStarted ? (
            <Timer
              duration={question.timeLimit}
              active={!locked && timedResponseStarted}
              onTimeUp={onTimeUp}
              resetKey={question.id}
              size="compact"
            />
          ) : undefined
        }
      />
      <div className={`${styles.storyPage} ${styles.questionPage}`}>
        <div className={styles.questionVisual} aria-hidden="true">
          <Image src={chapterImage} alt="" fill sizes="(max-width: 799px) 100vw, 34vw" />
          <div className={styles.visualShade} />
          <span>Registro {String(questionNumber).padStart(2, "0")}</span>
        </div>
        <article className={styles.questionArticle}>
          <div className={styles.questionMeta}>
            <span>
              Prueba {questionNumber} de {totalQuestions}
            </span>
            <ProgressBar current={questionNumber} total={totalQuestions} />
          </div>
          <h1>{question.question}</h1>
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

function NarrativeRecordTransition({ timedOut }: { timedOut: boolean }) {
  return (
    <motion.section
      className={styles.recordTransition}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
    >
      <NotebookIcon className="h-8 w-8" />
      <span>{timedOut ? "Tiempo agotado" : "Registro actualizado"}</span>
      <p>La evidencia queda conservada. El relato continúa.</p>
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
          className={styles.epilogueContinue}
          onClick={onContinue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1, duration: 0.45 }}
          whileTap={{ scale: 0.985 }}
        >
          Continuar al resultado
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
  const chapter = getChapterTitle(challenge, session.stepIndex);
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
                  chapter={chapter}
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
                chapter={chapter}
                pageNumber={session.stepIndex + 1}
                pageCount={pageCount}
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
              <NarrativeRecordTransition
                key={`narrative-transition-${session.stepIndex}`}
                timedOut={session.lastTimedOut}
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
