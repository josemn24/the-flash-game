"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { BoltIcon, HeartIcon, NotebookIcon } from "@/components/ui";
import { ProgressBar } from "@/components/game/shared/ProgressBar";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import { GameHeader, Timer } from "@/components/ui";
import { FlashPopQuestionInput } from "@/components/game/modes/flash-pop/FlashPopQuestionInput";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import styles from "./QuestionScreen.module.css";
import type { AnswerValue, Question } from "@/types/game";

type QuestionScreenProps = {
  question: Question;
  challengeTitle: string;
  questionNumber: number;
  totalQuestions: number;
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  codeAttemptCount: number;
  onCodeAttempt: (code: string) => boolean;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
  initialAnswer?: AnswerValue | null;
  deadlineAt?: number | null;
  onReady?: () => void;
  progressVariant?: "linear" | "pyramid";
  variant?: "legacy" | "flash-pop";
  livesRemaining?: number;
  totalLives?: number;
  notebook?: {
    entryCount: number;
    onOpen: () => void;
  };
  presentation?: {
    splitPrompt?: boolean;
    prominentMedia?: boolean;
  };
};

function splitQuestionPrompt(prompt: string) {
  const questionStart = prompt.lastIndexOf("¿");
  if (questionStart <= 0) return { title: prompt };
  return {
    context: prompt.slice(0, questionStart).trim(),
    title: prompt.slice(questionStart).trim(),
  };
}

export function QuestionScreen({
  question,
  challengeTitle,
  questionNumber,
  totalQuestions,
  locked,
  onSubmit,
  onTimeUp,
  codeAttemptCount,
  onCodeAttempt,
  onProgress,
  onIncorrectAttempt,
  onProgressiveClueReveal,
  onTimedResponseStart,
  initialAnswer,
  deadlineAt,
  onReady,
  progressVariant = "linear",
  variant = "legacy",
  livesRemaining,
  totalLives,
  notebook,
  presentation,
}: QuestionScreenProps) {
  const isFlashPop = variant === "flash-pop";
  const hasDelayedTimedResponse =
    question.type === "flash-memory" ||
    question.type === "simon-sequence" ||
    question.type === "mini-wordle" ||
    question.type === "progressive-image";
  const [timedResponseStarted, setTimedResponseStarted] = useState(!hasDelayedTimedResponse);
  const startTimedResponse = () => {
    setTimedResponseStarted(true);
    onTimedResponseStart();
  };
  const displayChallengeTitle = challengeTitle.split(":")[0].trim();
  const splitPrompt = presentation?.splitPrompt ?? isFlashPop;
  const prominentMedia = presentation?.prominentMedia ?? isFlashPop;
  const prompt = splitPrompt
    ? splitQuestionPrompt(question.question)
    : { title: question.question };

  useEffect(() => onReady?.(), [onReady]);

  return (
    <motion.section
      data-variant={variant}
      className={`mx-auto flex min-h-[100dvh] w-full flex-col ${isFlashPop ? styles.flashPopScreen : "max-w-3xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"}`}
      initial={{ opacity: 0, x: 34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -34 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <GameHeader
        className={isFlashPop ? styles.flashPopHeader : "mb-3 gap-4 sm:mb-4"}
        left={
          isFlashPop ? (
            <p className={styles.flashPopQuestionIndicator}>
              Pregunta {String(questionNumber).padStart(2, "0")}{" "}
              <span>de {String(totalQuestions).padStart(2, "0")}</span>
            </p>
          ) : (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className={styles.brandMarkSmall}>
                  <BoltIcon className="h-3.5 w-3.5" />
                </span>
                <p className={`${styles.eyebrow} truncate text-[var(--color-ink-muted)]`}>
                  {displayChallengeTitle}
                </p>
              </div>
            </div>
          )
        }
        mobileLabel={
          isFlashPop
            ? undefined
            : `Pregunta ${String(questionNumber).padStart(2, "0")} de ${String(totalQuestions).padStart(2, "0")}`
        }
        mobileLabelAriaLabel={
          isFlashPop ? undefined : `Pregunta ${questionNumber} de ${totalQuestions}`
        }
        right={
          <div className={isFlashPop ? styles.flashPopHeaderActions : "flex items-center gap-2"}>
            {notebook && (
              <button
                type="button"
                className={styles.notebookButton}
                onClick={notebook.onOpen}
                aria-label={`Abrir cuaderno de campo, ${notebook.entryCount} ${notebook.entryCount === 1 ? "entrada" : "entradas"}`}
              >
                <NotebookIcon className="h-4 w-4" />
                <span>{notebook.entryCount}</span>
              </button>
            )}
            {isFlashPop && typeof livesRemaining === "number" && typeof totalLives === "number" && (
              <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
            )}
            {!hasDelayedTimedResponse || timedResponseStarted ? (
              <Timer
                duration={question.timeLimit}
                active={
                  !locked &&
                  timedResponseStarted &&
                  (deadlineAt === undefined || typeof deadlineAt === "number")
                }
                onTimeUp={onTimeUp}
                resetKey={question.id}
                deadlineAt={deadlineAt ?? undefined}
                size="compact"
              />
            ) : null}
          </div>
        }
      />

      {!isFlashPop && (
        <div className="grid gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-sm font-bold tracking-wide text-[var(--color-ink)]">
              {progressVariant === "pyramid" ? "Nivel" : "Pregunta"} {questionNumber}
              <span className="text-[var(--color-ink-faint)]"> / {totalQuestions}</span>
            </p>
            <div className="flex min-w-0 items-center gap-2">
              {typeof livesRemaining === "number" && typeof totalLives === "number" && (
                <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
              )}
              <span className="min-w-0 text-right font-mono text-[11px] font-bold tracking-[0.14em] text-[var(--color-ink-faint)] uppercase">
                {QUESTION_FORMAT_LABELS[question.type]}
              </span>
            </div>
          </div>
          {progressVariant !== "pyramid" && (
            <ProgressBar current={questionNumber} total={totalQuestions} />
          )}
        </div>
      )}

      <div
        className={`flex flex-1 flex-col ${isFlashPop ? styles.flashPopQuestionBody : "pt-5 sm:pt-8"}`}
      >
        {prompt.context && <p className={styles.questionContext}>{prompt.context}</p>}
        <h1
          className={`${styles.questionTitle} ${splitPrompt ? styles.questionTitleFocused : ""} ${question.type === "ordering" || question.type === "logic-code" ? styles.questionTitleCompact : ""}`}
        >
          {prompt.title}
        </h1>

        {"media" in question && question.media && (
          <div className="mt-5 sm:mt-6">
            <QuestionMedia media={question.media} prominent={prominentMedia} />
          </div>
        )}

        <div className={isFlashPop ? styles.flashPopInput : undefined}>
          <FlashPopQuestionInput
            question={question}
            locked={locked}
            onSubmit={onSubmit}
            onCodeAttempt={onCodeAttempt}
            onProgress={onProgress}
            onIncorrectAttempt={onIncorrectAttempt}
            onProgressiveClueReveal={onProgressiveClueReveal}
            onTimedResponseStart={startTimedResponse}
            initialAnswer={initialAnswer}
            attemptCount={codeAttemptCount}
          />
        </div>
      </div>
    </motion.section>
  );
}

function LifeHearts({
  livesRemaining,
  totalLives,
}: {
  livesRemaining: number;
  totalLives: number;
}) {
  const safeTotalLives = Math.max(0, totalLives);
  const safeLivesRemaining = Math.min(Math.max(0, livesRemaining), safeTotalLives);

  return (
    <span
      className={styles.lifeHearts}
      aria-label={`${safeLivesRemaining} de ${safeTotalLives} vidas restantes`}
    >
      {Array.from({ length: safeTotalLives }, (_, index) => {
        const active = index < safeLivesRemaining;
        return (
          <HeartIcon
            key={index}
            className={`${styles.lifeHeart} ${active ? styles.lifeHeartActive : styles.lifeHeartLost}`}
          />
        );
      })}
    </span>
  );
}
