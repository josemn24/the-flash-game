"use client";

import type { ReactNode } from "react";
import { useEffect, useId } from "react";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import { Timer } from "@/components/ui";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { useQuestionStageTimer } from "@/features/game/useQuestionStageTimer";
import type { AnswerValue, Question } from "@/types/game";
import styles from "./QuestionStage.module.css";

export type QuestionStageHeaderRenderParams = {
  timer: ReactNode;
  questionNumber: number;
  totalQuestions: number;
};

export type QuestionStageProps = {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  locked: boolean;
  codeAttemptCount: number;
  onSubmit: (answer: AnswerValue) => void;
  onTimeUp: () => void;
  onCodeAttempt: (code: string) => boolean;
  onProgress: (answer: AnswerValue) => void;
  onIncorrectAttempt: () => void;
  onProgressiveClueReveal: (revealedClues: number) => void;
  onTimedResponseStart: () => void;
  initialAnswer?: AnswerValue | null;
  deadlineAt?: number | null;
  onReady?: () => void;
  renderHeader: (params: QuestionStageHeaderRenderParams) => ReactNode;
  renderQuestionMeta?: (params: { questionNumber: number; totalQuestions: number }) => ReactNode;
  presentation?: {
    splitPrompt?: boolean;
    prominentMedia?: boolean;
  };
  className?: string;
};

function splitQuestionPrompt(prompt: string) {
  const questionStart = prompt.lastIndexOf("¿");
  if (questionStart <= 0) return { title: prompt };
  return {
    context: prompt.slice(0, questionStart).trim(),
    title: prompt.slice(questionStart).trim(),
  };
}

export function QuestionStage({
  question,
  questionNumber,
  totalQuestions,
  locked,
  codeAttemptCount,
  onSubmit,
  onTimeUp,
  onCodeAttempt,
  onProgress,
  onIncorrectAttempt,
  onProgressiveClueReveal,
  onTimedResponseStart,
  initialAnswer,
  deadlineAt,
  onReady,
  renderHeader,
  renderQuestionMeta,
  presentation,
  className,
}: QuestionStageProps) {
  const titleId = useId();
  const splitPrompt = presentation?.splitPrompt ?? true;
  const prominentMedia = presentation?.prominentMedia ?? true;
  const prompt = splitPrompt
    ? splitQuestionPrompt(question.question)
    : { title: question.question };
  const timer = useQuestionStageTimer({
    question,
    locked,
    deadlineAt,
    onTimeUp,
    onTimedResponseStart,
  });

  useEffect(() => onReady?.(), [onReady]);

  return (
    <div className={`${styles.stage} ${className ?? ""}`}>
      {renderHeader({
        timer: (
          <Timer
            duration={question.timeLimit}
            active={timer.active}
            onTimeUp={timer.onTimeUp}
            resetKey={question.id}
            deadlineAt={deadlineAt ?? undefined}
            size="compact"
          />
        ),
        questionNumber,
        totalQuestions,
      })}

      {renderQuestionMeta?.({ questionNumber, totalQuestions })}

      <section className={styles.questionCard} aria-labelledby={titleId}>
        {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
        <h1 id={titleId}>{prompt.title}</h1>
        {"media" in question && question.media ? (
          <div className={styles.questionMedia}>
            <QuestionMedia media={question.media} prominent={prominentMedia} />
          </div>
        ) : null}
        <QuestionInput
          question={question}
          locked={locked}
          onSubmit={onSubmit}
          onProgress={onProgress}
          onIncorrectAttempt={onIncorrectAttempt}
          onProgressiveClueReveal={onProgressiveClueReveal}
          onCodeAttempt={onCodeAttempt}
          onTimedResponseStart={timer.start}
          initialAnswer={initialAnswer}
          codeAttemptCount={codeAttemptCount}
        />
      </section>
    </div>
  );
}
