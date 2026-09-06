"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  RotateIcon,
  Card,
  Canvas,
  Chip,
  GameHeader,
  MotionButton,
  Timer,
} from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { FlashPopQuestionInput } from "@/components/game/modes/flash-pop/FlashPopQuestionInput";
import { ReviewAnswers } from "@/components/game/shared/ReviewAnswers";
import { useNarrativeSession } from "@/features/narrative/useNarrativeSession";
import styles from "./NarrativeGame.module.css";
import type {
  AnswerResult,
  AnswerValue,
  NarrativeChallenge,
  NarrativeScene,
  NarrativeTextBlock,
  Question,
} from "@/types/game";

function NarrativeSceneProgress({
  pageNumber,
  pageCount,
}: {
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <div className={styles.storyChrome}>
      <span className={styles.storyFolio} aria-label={`Página ${pageNumber} de ${pageCount}`}>
        {String(pageNumber).padStart(2, "0")} / {pageCount}
      </span>
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
      <GameHeader title="Narrativa" action={<Chip tone="social">Cuento en tres capítulos</Chip>} />

      <div className={styles.introContent}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Narrativa competitiva</p>
          <h1>{challenge.title}</h1>
          <p className={styles.subtitle}>{challenge.subtitle}</p>
          <p className={styles.description}>{challenge.description}</p>
        </div>

        <Card as="section" className={styles.introPanel}>
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
        </Card>
      </div>
    </motion.section>
  );
}

function NarrativeSceneScreen({
  scene,
  pageNumber,
  pageCount,
  reactionBlocks,
  onContinue,
}: {
  scene: NarrativeScene;
  pageNumber: number;
  pageCount: number;
  reactionBlocks: NarrativeTextBlock[];
  onContinue: () => void;
}) {
  const presentation = scene.presentation ?? "standard";
  const isDarkPresentation = presentation === "chapter-opening" || presentation === "full-bleed";
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
      className={`${styles.storyScreen} ${scene.media?.type === "image" ? styles.storyScreenImage : ""}`}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
    >
      <NarrativeSceneProgress pageNumber={pageNumber} pageCount={pageCount} />
      <div
        className={`${styles.storyPage} ${presentationClass} ${isDarkPresentation ? styles.storyPageDark : ""}`}
      >
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
      <GameHeader
        className={styles.questionHud}
        left={
          <p className={styles.questionIndicator}>
            Prueba {String(questionNumber).padStart(2, "0")}{" "}
            <span>de {String(totalQuestions).padStart(2, "0")}</span>
          </p>
        }
        timer={
          !hasDelayedStart || timedResponseStarted ? (
            <Timer
              duration={question.timeLimit}
              active={!locked && timedResponseStarted}
              onTimeUp={onTimeUp}
              resetKey={question.id}
              size="compact"
            />
          ) : null
        }
      />
      <section className={styles.questionPage}>
        <article className={styles.questionArticle}>
          <h1>{question.question}</h1>
          {question.questionContext && (
            <p className={styles.questionContext}>{question.questionContext}</p>
          )}
          {"media" in question && question.media && (
            <div className={styles.questionMedia}>
              <QuestionMedia media={question.media} prominent />
            </div>
          )}
          <FlashPopQuestionInput
            question={question}
            locked={locked}
            onSubmit={onSubmit}
            onProgress={onProgress}
            onIncorrectAttempt={onIncorrectAttempt}
            onProgressiveClueReveal={() => undefined}
            onCodeAttempt={() => false}
            onTimedResponseStart={startTimedResponse}
          />
        </article>
      </section>
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
  score,
  onReview,
  onReplay,
}: {
  challenge: NarrativeChallenge;
  results: AnswerResult[];
  score: number;
  onReview: () => void;
  onReplay: () => void;
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
      <GameHeader title="Narrativa" action={<Chip tone="success">Misión completada</Chip>} />
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
              <CheckIcon className="h-5 w-5" /> Revisar respuestas
            </MotionButton>
            <MotionButton variant="secondary" onClick={onReplay} whileTap={{ scale: 0.985 }}>
              <RotateIcon className="h-5 w-5" /> Volver a jugar
            </MotionButton>
            <Link className={styles.backLink} href="/">
              Volver a desafíos
            </Link>
          </div>
        </div>

        <Card as="section" className={styles.resultDetails}>
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
          <div className={styles.timeSummary}>
            <span>Tiempo competitivo</span>
            <strong>{formatTime(totalTime)}</strong>
          </div>
          <p className={styles.resultNotice}>
            La trayectoria está documentada. Su causa permanece fuera del registro.
          </p>
        </Card>
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
  const isDarkStoryScene =
    session.phase === "scene" &&
    session.currentStep?.type === "scene" &&
    (session.currentStep.scene.presentation === "chapter-opening" ||
      session.currentStep.scene.presentation === "full-bleed");
  const narrativeFeedbackStatus = session.lastTimedOut
    ? "unanswered"
    : (session.results.at(-1)?.status ?? "incorrect");
  const narrativeFeedbackCopy = getFlashPopFeedbackCopy({
    status: narrativeFeedbackStatus,
    timedOut: session.lastTimedOut,
    nextLabel: "escena",
  });

  return (
    <MotionConfig reducedMotion="user">
      <main
        data-mode="narrative"
        data-variant="flash-pop"
        className={`${styles.gameRoot} ${session.phase === "playing" ? styles.questionPhase : ""} ${isBlackoutScene ? styles.blackoutPhase : ""} ${isDarkStoryScene ? styles.darkStoryPhase : ""}`}
      >
        <PolarBackground />
        <Canvas
          as="div"
          maxWidth="none"
          className={styles.flashPopCanvas}
          contentClassName={styles.flashPopCanvasContent}
        >
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
                    onContinue={session.continueScene}
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
                />
              )}
              {session.phase === "transition" && (
                <motion.div
                  className={styles.feedbackStage}
                  key={`feedback-${session.stepIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FlashPopFeedback
                    status={narrativeFeedbackStatus}
                    title={narrativeFeedbackCopy.title}
                    body={narrativeFeedbackCopy.body}
                    points={
                      narrativeFeedbackStatus === "correct" || narrativeFeedbackStatus === "partial"
                        ? session.results.at(-1)?.points
                        : undefined
                    }
                  />
                </motion.div>
              )}
              {session.phase === "results" && (
                <NarrativeResult
                  key="narrative-results"
                  challenge={challenge}
                  results={session.results}
                  score={session.score}
                  onReview={session.showReview}
                  onReplay={session.replay}
                />
              )}
              {session.phase === "review" && (
                <ReviewAnswers
                  key="narrative-review"
                  challenge={challenge}
                  results={session.results}
                  onBack={session.showResults}
                  onReplay={session.replay}
                  variant="flash-pop"
                />
              )}
            </AnimatePresence>
          </div>
        </Canvas>
      </main>
    </MotionConfig>
  );
}
