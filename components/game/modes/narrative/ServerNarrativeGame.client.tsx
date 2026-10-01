"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Image from "next/image";
import {
  ArrowIcon,
  BoltIcon,
  Canvas,
  Card,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  MotionButton,
} from "@/components/ui";
import { ChallengeIntro } from "@/components/game/shared/ChallengeIntro";
import {
  ChallengeResultScreen,
  ServerFlashQuestionStage,
} from "@/components/game/shared";
import { AnswerFeedbackStage } from "@/components/game/modes/flash-pop/AnswerFeedbackStage";
import {
  FlashPopFeedback,
  getFlashPopFeedbackCopy,
} from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ReviewStage } from "@/components/game/modes/flash-pop/FlashPopCompetitiveHelpers";
import { calculateResultAccuracy, getAnswerResultAccuracyUnit } from "@/features/game/resultSummary";
import { useServerNarrativeSession } from "@/features/game/useServerNarrativeSession";
import type {
  AnswerResult,
  NarrativeScene,
  NarrativeTextBlock,
  ServerFlashTerminalReview,
  ServerNarrativeChallenge,
} from "@/types/gameplay";
import type { GameRoomContext } from "@/types/view-models/room";
import styles from "./NarrativeGame.module.css";

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
  blocks: readonly NarrativeTextBlock[];
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

function NarrativeSceneScreen({
  scene,
  pageNumber,
  pageCount,
  onContinue,
}: {
  scene: NarrativeScene;
  pageNumber: number;
  pageCount: number;
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
        {scene.media?.type === "image" ? (
          <div className={styles.storyVisual}>
            <Image
              src={scene.media.src}
              alt={scene.media.alt}
              fill
              sizes="(max-width: 799px) 100vw, 68vw"
              className={scene.media.fit === "contain" ? styles.storyImageContain : styles.storyImage}
              style={{ objectPosition: scene.media.position }}
              priority={scene.id === "scene-prologue-recording"}
            />
            <div className={styles.visualShade} aria-hidden="true" />
            {scene.caption ? <p className={styles.storyCaption}>{scene.caption}</p> : null}
            {scene.id === "scene-prologue-recording" ? (
              <div className={styles.tapeSignal} aria-label="Siseo de una grabación antigua">
                <span>REC · ARCHIVO</span>
                {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
              </div>
            ) : null}
          </div>
        ) : null}
        <article className={styles.storyArticle}>
          {scene.eyebrow ? <p className={styles.eyebrow}>{scene.eyebrow}</p> : null}
          {scene.title ? <h1>{scene.title}</h1> : null}
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

function PolarBackground() {
  return (
    <div className={styles.polarBackground} aria-hidden="true">
      <div className={styles.aurora} />
      <div className={styles.horizon} />
      <div className={styles.snow} />
    </div>
  );
}

function NarrativeResult({
  results,
  score,
  maxScore,
  onReview,
  returnTo,
  expired,
}: {
  results: AnswerResult[];
  score: number;
  maxScore: number;
  onReview: (() => void) | undefined;
  returnTo: string;
  expired: boolean;
}) {
  const correct = results.filter((result) => result.status === "correct").length;
  const partial = results.filter((result) => result.status === "partial").length;
  const unanswered = results.filter((result) => result.status === "unanswered").length;
  const incorrect = results.length - correct - partial - unanswered;
  const totalTime = results.reduce((total, result) => total + result.timeUsed, 0);
  const accuracy = calculateResultAccuracy(results.map(getAnswerResultAccuracyUnit));
  return (
    <ChallengeResultScreen
      model={{
        gameTitle: "Narrativa",
        statusLabel: "Completado",
        eyebrow: "Desafío completado",
        title: "El recorrido queda registrado.",
        score,
        maxScore,
        accuracy,
        totalTime,
        metrics: [
          { icon: <CheckIcon />, label: "Correctas", value: correct, tone: "success" },
          { icon: <BoltIcon />, label: "Parciales", value: partial, tone: "social" },
          { icon: <CrossIcon />, label: "Falladas", value: incorrect, tone: "danger" },
          { icon: <ClockIcon />, label: "Sin respuesta", value: unanswered },
        ],
      }}
      onReview={onReview}
      expired={expired}
      returnTo={returnTo}
      returnLabel="Volver"
    />
  );
}

export function ServerNarrativeGame({
  challenge,
  roomContext,
  terminalReview,
}: {
  challenge: ServerNarrativeChallenge;
  roomContext: GameRoomContext;
  terminalReview?: readonly ServerFlashTerminalReview[];
}) {
  const session = useServerNarrativeSession({ challenge, roomContext, terminalReview });
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
  const feedbackStatus = session.lastResult?.status ?? "incorrect";
  const feedbackCopy = getFlashPopFeedbackCopy({
    status: session.lastResult?.status ?? "incorrect",
    timedOut: session.lastResult?.status === "unanswered",
    nextLabel: "escena",
  });

  return (
    <MotionConfig reducedMotion="user">
      <main
        data-mode="narrative"
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
              {session.phase === "intro" ? (
                <motion.div key="narrative-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ChallengeIntro
                    introduction={{
                      title: challenge.title,
                      mode: "narrative",
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
                  <p className="mt-2">Comprobamos de forma segura el último estado de tu intento.</p>
                </Card>
              ) : null}
              {session.phase === "scene" && session.currentStep?.type === "scene" ? (
                session.currentStep.scene.presentation === "blackout" ? (
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
                    onContinue={session.continueScene}
                  />
                )
              ) : null}
              {session.phase === "preparing" ? (
                <Card key="preparing" role="status" aria-live="polite" className="mx-auto mt-12 max-w-xl">
                  <h1>Preparando la siguiente prueba</h1>
                  <p className="mt-2">La pregunta se libera ahora desde el servidor.</p>
                </Card>
              ) : null}
              {session.phase === "playing" && session.question ? (
                <motion.div
                  key={session.question.id}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                >
                  <ServerFlashQuestionStage
                    question={session.question}
                    questionNumber={session.questionNumber}
                    totalQuestions={challenge.slots.length}
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
                    queensState={session.queensState}
                    queensStatusVisible={session.queensStatusVisible}
                    queensError={session.queensError}
                    onQueensDraft={session.updateQueensDraft}
                    onQueensValidate={(queens) => void session.validateQueensBoard(queens)}
                    onRetryQueensValidation={session.retryQueensValidation}
                    wordSearchState={session.wordSearchState}
                    wordSearchStatusVisible={session.wordSearchStatusVisible}
                    wordSearchError={session.wordSearchError}
                    lastWordSearchSelection={session.lastWordSearchSelection}
                    onWordSearchSelection={(startCell, endCell) =>
                      void session.submitWordSearchSelection(startCell, endCell)
                    }
                    onRetryWordSearch={session.retryWordSearchSelection}
                    onWordHashtagSwap={(fromCell, toCell) =>
                      void session.submitWordHashtagSwap(fromCell, toCell)
                    }
                    revealState={session.revealState}
                    revealStatusVisible={session.revealStatusVisible}
                    revealError={session.revealError}
                    onRevealProgressiveClue={session.revealProgressiveClue}
                    onRetryReveal={session.retryReveal}
                    onTimeUp={session.handleTimeUp}
                  />
                </motion.div>
              ) : null}
              {session.phase === "checking" ? (
                <AnswerFeedbackStage
                  key="narrative-checking"
                  state="checking"
                  indicatorVisible={session.submissionStatusVisible}
                />
              ) : null}
              {session.phase === "transition" ? (
                <motion.div
                  className={styles.feedbackStage}
                  key={`feedback-${session.stepIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FlashPopFeedback
                    status={feedbackStatus}
                    title={feedbackCopy.title}
                    body={feedbackCopy.body}
                    points={
                      feedbackStatus === "correct" || feedbackStatus === "partial"
                        ? session.lastResult?.points
                        : undefined
                    }
                  />
                </motion.div>
              ) : null}
              {session.phase === "results" ? (
                <motion.div key="narrative-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <NarrativeResult
                    results={session.results}
                    score={session.score}
                    maxScore={challenge.maxScore}
                    onReview={session.reviewChallenge ? session.showReview : undefined}
                    returnTo={roomContext.returnTo}
                    expired={session.attemptExpired}
                  />
                </motion.div>
              ) : null}
              {session.phase === "review" && session.reviewChallenge ? (
                <motion.div key="narrative-review" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ReviewStage
                    challenge={session.reviewChallenge}
                    results={session.results}
                    onBack={session.showResults}
                    returnTo={roomContext.returnTo}
                    roomContext={roomContext}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Canvas>
      </main>
    </MotionConfig>
  );
}
