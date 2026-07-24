"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { BoltIcon } from "@/components/icons";
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
  onMatchingIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
};

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
  onMatchingIncorrectAttempt,
  onProgressiveClueReveal,
  onTimedResponseStart,
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
          !hasDelayedTimedResponse || timedResponseStarted ? (
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

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono text-sm font-bold tracking-wide text-white">
            Pregunta {questionNumber}
            <span className="text-white/35"> / {totalQuestions}</span>
          </p>
          <span className="shrink-0 font-mono text-[11px] font-bold tracking-[0.14em] text-white/35 uppercase">
            {QUESTION_FORMAT_LABELS[question.type]}
          </span>
        </div>
        <ProgressBar current={questionNumber} total={totalQuestions} />
      </div>

      <div className="flex flex-1 flex-col pt-5 sm:pt-8">
        <h1
          className={`${styles.questionTitle} ${question.type === "ordering" || question.type === "logic-code" ? styles.questionTitleCompact : ""}`}
        >
          {question.question}
        </h1>

        {"media" in question && question.media && (
          <div className="mt-5 sm:mt-6">
            <QuestionMedia media={question.media} />
          </div>
        )}

        <QuestionInput
          question={question}
          locked={locked}
          onSubmit={onSubmit}
          codeAttemptCount={codeAttemptCount}
          onCodeAttempt={onCodeAttempt}
          onProgress={onProgress}
          onMatchingIncorrectAttempt={onMatchingIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onTimedResponseStart={startTimedResponse}
        />
      </div>
    </motion.section>
  );
}
