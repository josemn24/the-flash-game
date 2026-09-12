"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { HeartIcon, NotebookIcon } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import { GameHeader, Timer } from "@/components/ui";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import styles from "./QuestionScreen.module.css";
import type { AnswerValue, Question } from "@/types/game";

type QuestionScreenProps = {
  question: Question;
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
  const splitPrompt = presentation?.splitPrompt ?? true;
  const prominentMedia = presentation?.prominentMedia ?? true;
  const prompt = splitPrompt
    ? splitQuestionPrompt(question.question)
    : { title: question.question };

  useEffect(() => onReady?.(), [onReady]);

  return (
    <motion.section
      className={`mx-auto flex min-h-[100dvh] w-full flex-col ${styles.flashPopScreen}`}
      initial={{ opacity: 0, x: 34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -34 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <GameHeader
        className={styles.flashPopHeader}
        left={
          <p className={styles.flashPopQuestionIndicator}>
            Pregunta {String(questionNumber).padStart(2, "0")} {" "}
            <span>de {String(totalQuestions).padStart(2, "0")}</span>
          </p>
        }
        right={
          <div className={styles.flashPopHeaderActions}>
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
            {typeof livesRemaining === "number" && typeof totalLives === "number" && (
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

      <div className={`flex flex-1 flex-col ${styles.flashPopQuestionBody}`}>
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

        <div className={styles.flashPopInput}>
          <QuestionInput
            question={question}
            locked={locked}
            onSubmit={onSubmit}
            onCodeAttempt={onCodeAttempt}
            onProgress={onProgress}
            onIncorrectAttempt={onIncorrectAttempt}
            onProgressiveClueReveal={onProgressiveClueReveal}
            onTimedResponseStart={startTimedResponse}
            initialAnswer={initialAnswer}
            codeAttemptCount={codeAttemptCount}
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
