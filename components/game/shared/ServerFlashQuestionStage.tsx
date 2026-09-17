"use client";

import { useId } from "react";
import { AnswerOption } from "@/components/questions/shared";
import { ServerMiniWordleQuestion } from "@/components/questions/formats/mini-wordle/ServerMiniWordleQuestion";
import { ServerLogicCodeQuestion } from "@/components/questions/formats/logic-code/ServerLogicCodeQuestion";
import { Timer, GameHeader } from "@/components/ui";
import type { AnswerValue } from "@/types/game";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import styles from "./QuestionStage.module.css";
import variantStyles from "./QuestionStageVariants.module.css";

function splitPrompt(prompt: string) {
  const index = prompt.lastIndexOf("¿");
  return index > 0 ? { context: prompt.slice(0, index).trim(), title: prompt.slice(index).trim() } : { title: prompt };
}

export function ServerFlashQuestionStage({
  question,
  questionNumber,
  totalQuestions,
  locked,
  pendingAnswer,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onRetrySubmission,
  onSubmit,
  onMiniWordleGuess,
  onLogicCodeAttempt,
  onTimeUp,
}: {
  readonly question: ServerFlashQuestion;
  readonly questionNumber: number;
  readonly totalQuestions: number;
  readonly locked: boolean;
  readonly pendingAnswer?: AnswerValue | null;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onRetrySubmission?: () => void;
  readonly onSubmit: (answer: AnswerValue) => void;
  readonly onMiniWordleGuess: (guess: string) => void;
  readonly onLogicCodeAttempt: (code: string) => void;
  readonly onTimeUp: () => void;
}) {
  const titleId = useId();
  const prompt = splitPrompt(question.question);
  const selected = question.type === "multiple-choice" && typeof pendingAnswer === "string" ? pendingAnswer : null;

  return (
    <div className={`${variantStyles.stageFrame} ${styles.stage}`}>
      <GameHeader
        left={<p className={variantStyles.questionIndicator} aria-label={`Pregunta ${questionNumber} de ${totalQuestions}`}>
          Pregunta {String(questionNumber).padStart(2, "0")} <span>de {String(totalQuestions).padStart(2, "0")}</span>
        </p>}
        timer={
          <Timer
            duration={question.timeLimit}
            active={!locked}
            onTimeUp={onTimeUp}
            resetKey={question.id}
            size="compact"
          />
        }
      />
      <section className={styles.questionCard} aria-labelledby={titleId}>
        {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
        <h1 id={titleId}>{prompt.title}</h1>
        {question.type === "mini-wordle" ? (
          <ServerMiniWordleQuestion
            question={question}
            progress={question.progress}
            locked={locked}
            submissionState={submissionState}
            submissionStatusVisible={submissionStatusVisible}
            submissionError={submissionError}
            onRetry={onRetrySubmission}
            onSubmit={onMiniWordleGuess}
          />
        ) : question.type === "logic-code" ? (
          <ServerLogicCodeQuestion
            clues={question.clues}
            codeLength={question.codeLength}
            progress={question.progress}
            locked={locked}
            submissionState={submissionState}
            submissionStatusVisible={submissionStatusVisible}
            submissionError={submissionError}
            onRetry={onRetrySubmission}
            onSubmit={onLogicCodeAttempt}
          />
        ) : (
          <>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {question.options.map((option, index) => (
                <AnswerOption
                  key={option}
                  label={option}
                  index={index}
                  selected={selected === option}
                  pending={selected === option}
                  disabled={locked}
                  onSelect={() => onSubmit(option)}
                />
              ))}
            </div>
            {submissionState !== "idle" ? (
              <div className="mt-4" role="status" aria-live="polite">
                <p>
                  {submissionState === "submitting" && submissionStatusVisible
                    ? "Comprobando respuesta…"
                    : submissionError ?? "No hemos podido confirmar tu respuesta."}
                </p>
                {submissionState === "error" && onRetrySubmission ? (
                  <button type="button" onClick={onRetrySubmission}>Reintentar</button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
