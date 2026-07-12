"use client";

import { motion } from "motion/react";
import { BoltIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionMedia } from "@/components/QuestionMedia";
import { Timer } from "@/components/Timer";
import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { QUESTION_FORMAT_LABELS } from "@/lib/questionFormat";
import styles from "@/components/QuestionScreen.module.css";
import type { AnswerValue, Question } from "@/types/game";

type QuestionScreenProps = {
  question: Question;
  stageTitle: string;
  questionNumber: number;
  totalQuestions: number;
  locked: boolean;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  codeAttemptCount: number;
  onCodeAttempt: (code: string) => boolean;
};

export function QuestionScreen({
  question,
  stageTitle,
  questionNumber,
  totalQuestions,
  locked,
  onSubmit,
  onTimeUp,
  codeAttemptCount,
  onCodeAttempt,
}: QuestionScreenProps) {
  return (
    <motion.section
      className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
      initial={{ opacity: 0, x: 34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -34 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppHeader
        className="mb-5 gap-4 sm:mb-7"
        left={
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className={styles.brandMarkSmall}>
                <BoltIcon className="h-3.5 w-3.5" />
              </span>
              <p className={`${styles.eyebrow} text-white/55`}>{stageTitle}</p>
            </div>
            <p className="font-mono text-sm font-bold tracking-wide text-white">
              Pregunta {questionNumber}
              <span className="text-white/35"> / {totalQuestions}</span>
            </p>
          </div>
        }
        right={<Timer duration={question.timeLimit} active={!locked} onTimeUp={onTimeUp} />}
      />

      <ProgressBar current={questionNumber} total={totalQuestions} />

      <div className="flex flex-1 flex-col pt-6 sm:pt-9">
        <div className="mb-4 flex items-center justify-between">
          <Badge>{question.category}</Badge>
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-white/35 uppercase">
            {QUESTION_FORMAT_LABELS[question.type]}
          </span>
        </div>

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
        />
      </div>
    </motion.section>
  );
}
