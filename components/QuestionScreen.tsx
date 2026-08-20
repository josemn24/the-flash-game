"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { BoltIcon, HeartIcon, NotebookIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionMedia } from "@/components/QuestionMedia";
import { Timer } from "@/components/Timer";
import { AppHeader } from "@/components/ui/AppHeader";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import styles from "@/components/QuestionScreen.module.css";
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
  progressLabels?: string[];
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
  progressLabels,
  livesRemaining,
  totalLives,
  notebook,
  presentation,
}: QuestionScreenProps) {
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
  const prompt = presentation?.splitPrompt
    ? splitQuestionPrompt(question.question)
    : { title: question.question };

  useEffect(() => onReady?.(), [onReady]);

  return (
    <motion.section
      className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
      initial={{ opacity: 0, x: 34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -34 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppHeader
        className="mb-3 gap-4 sm:mb-4"
        left={
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className={styles.brandMarkSmall}>
                <BoltIcon className="h-3.5 w-3.5" />
              </span>
              <p className={`${styles.eyebrow} truncate text-white/55`}>{displayChallengeTitle}</p>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
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

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono text-sm font-bold tracking-wide text-white">
            {progressVariant === "pyramid" ? "Nivel" : "Pregunta"} {questionNumber}
            <span className="text-white/35"> / {totalQuestions}</span>
          </p>
          <div className="flex min-w-0 items-center gap-2">
            {typeof livesRemaining === "number" && typeof totalLives === "number" && (
              <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
            )}
            <span className="min-w-0 text-right font-mono text-[11px] font-bold tracking-[0.14em] text-white/35 uppercase">
              {QUESTION_FORMAT_LABELS[question.type]}
            </span>
          </div>
        </div>
        {progressVariant === "pyramid" ? (
          <ol className={styles.pyramidProgress} aria-label="Progreso por la pirámide">
            {(
              progressLabels ?? Array.from({ length: totalQuestions }, (_, index) => `${index + 1}`)
            ).map((label, index) => (
              <li
                key={`${label}-${index}`}
                className={
                  index + 1 < questionNumber
                    ? styles.pyramidProgressCleared
                    : index + 1 === questionNumber
                      ? styles.pyramidProgressCurrent
                      : styles.pyramidProgressLocked
                }
                aria-current={index + 1 === questionNumber ? "step" : undefined}
              >
                <span>{index + 1}</span>
                <small>{label}</small>
              </li>
            ))}
          </ol>
        ) : (
          <ProgressBar current={questionNumber} total={totalQuestions} />
        )}
      </div>

      <div className="flex flex-1 flex-col pt-5 sm:pt-8">
        {prompt.context && <p className={styles.questionContext}>{prompt.context}</p>}
        <h1
          className={`${styles.questionTitle} ${presentation?.splitPrompt ? styles.questionTitleFocused : ""} ${question.type === "ordering" || question.type === "logic-code" ? styles.questionTitleCompact : ""}`}
        >
          {prompt.title}
        </h1>

        {"media" in question && question.media && (
          <div className="mt-5 sm:mt-6">
            <QuestionMedia media={question.media} prominent={presentation?.prominentMedia} />
          </div>
        )}

        <QuestionInput
          question={question}
          locked={locked}
          onSubmit={onSubmit}
          codeAttemptCount={codeAttemptCount}
          onCodeAttempt={onCodeAttempt}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onTimedResponseStart={startTimedResponse}
          initialAnswer={initialAnswer}
        />
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
