"use client";

import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CrossIcon,
  MotionButton,
} from "@/components/ui";
import { ChallengeResultScreen } from "@/components/game/shared";
import {
  calculateResultAccuracy,
  getAnswerResultAccuracyUnit,
} from "@/features/game/resultSummary";
import type { AnswerResult, NarrativeScene, NarrativeTextBlock } from "@/types/gameplay";
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

export function NarrativeSceneScreen({
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
              className={
                scene.media.fit === "contain" ? styles.storyImageContain : styles.storyImage
              }
              style={{ objectPosition: scene.media.position }}
              priority={scene.id === "scene-prologue-recording"}
            />
            <div className={styles.visualShade} aria-hidden="true" />
            {scene.caption ? <p className={styles.storyCaption}>{scene.caption}</p> : null}
            {scene.id === "scene-prologue-recording" ? (
              <div className={styles.tapeSignal} aria-label="Siseo de una grabación antigua">
                <span>REC · ARCHIVO</span>
                {Array.from({ length: 12 }, (_, index) => (
                  <i key={index} />
                ))}
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

export function NarrativeEpilogueScreen({ onContinue }: { onContinue: () => void }) {
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

export function PolarBackground() {
  return (
    <div className={styles.polarBackground} aria-hidden="true">
      <div className={styles.aurora} />
      <div className={styles.horizon} />
      <div className={styles.snow} />
    </div>
  );
}

export function NarrativeResult({
  results,
  score,
  maxScore,
  onReview,
  returnTo,
  expired = false,
}: {
  results: readonly AnswerResult[];
  score: number;
  maxScore: number;
  onReview?: () => void;
  returnTo: string;
  expired?: boolean;
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
