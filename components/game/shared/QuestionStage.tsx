"use client";

import type { ReactNode } from "react";
import { useEffect, useId } from "react";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import { Timer } from "@/components/ui";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { useQuestionStageTimer } from "@/features/game/useQuestionStageTimer";
import type { PracticeInput } from "@/features/question-formats/practiceInputTypes";
import { withPracticeTimedResponseStart } from "@/features/question-formats/withPracticeTimedResponseStart";
import styles from "./QuestionStage.module.css";
import { KeyboardGameLayout } from "@/components/ui/KeyboardGameLayout";

export type QuestionStageHeaderRenderParams = {
  timer: ReactNode;
  questionNumber: number;
  totalQuestions: number;
};

export type QuestionStageProps = {
  input: PracticeInput;
  questionNumber: number;
  totalQuestions: number;
  onTimeUp: () => void;
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
  input,
  questionNumber,
  totalQuestions,
  onTimeUp,
  deadlineAt,
  onReady,
  renderHeader,
  renderQuestionMeta,
  presentation,
  className,
}: QuestionStageProps) {
  const { question, locked } = input.props;
  const onTimedResponseStart =
    "onTimedResponseStart" in input.props ? input.props.onTimedResponseStart : undefined;
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

  const header = (
    <>
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
    </>
  );
  const content = (
    <section className={styles.questionCard} aria-labelledby={titleId}>
      {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
      <h1 id={titleId}>{prompt.title}</h1>
      {input.format === "mini-wordle" && question.questionContext ? (
        <p className={styles.promptContext}>{question.questionContext}</p>
      ) : null}
      {"media" in question && question.media ? (
        <div className={styles.questionMedia}>
          <QuestionMedia media={question.media} prominent={prominentMedia} />
        </div>
      ) : null}
      <QuestionInput input={withPracticeTimedResponseStart(input, timer.start)} />
    </section>
  );

  if (input.format === "mini-wordle") {
    return <KeyboardGameLayout header={header}>{content}</KeyboardGameLayout>;
  }
  return (
    <div className={`${styles.stage} ${className ?? ""}`}>
      {header}
      {content}
    </div>
  );
}
