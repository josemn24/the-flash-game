"use client";

import { useId } from "react";
import { AnswerOption, QuestionMedia } from "@/components/questions/shared";
import { ServerMiniWordleQuestion } from "@/components/questions/formats/mini-wordle/ServerMiniWordleQuestion";
import { ServerLogicCodeQuestion } from "@/components/questions/formats/logic-code/ServerLogicCodeQuestion";
import { ServerMatchingQuestion } from "@/components/questions/formats/matching/ServerMatchingQuestion";
import { ServerProgressiveCluesQuestion } from "@/components/questions/formats/progressive-clues/ServerProgressiveCluesQuestion";
import { ProgressiveImageQuestion } from "@/components/questions/formats/progressive-image/ProgressiveImageQuestion";
import { Timer, GameHeader } from "@/components/ui";
import type { AnswerValue } from "@/types/game";
import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import styles from "./QuestionStage.module.css";
import variantStyles from "./QuestionStageVariants.module.css";

function splitPrompt(prompt: string) {
  const index = prompt.lastIndexOf("¿");
  return index > 0
    ? { context: prompt.slice(0, index).trim(), title: prompt.slice(index).trim() }
    : { title: prompt };
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
  matchingState,
  matchingStatusVisible,
  matchingError,
  lastMatchingPair,
  onMatchingPair,
  onRetryMatching,
  revealState,
  revealStatusVisible,
  revealError,
  onRevealProgressiveClue,
  onRetryReveal,
  onTimeUp,
  deadlineAt,
  presentedAt,
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
  readonly matchingState: "idle" | "submitting" | "error";
  readonly matchingStatusVisible: boolean;
  readonly matchingError?: string;
  readonly lastMatchingPair?: {
    readonly leftId: string;
    readonly rightId: string;
    readonly correct: boolean;
  };
  readonly onMatchingPair: (leftId: string, rightId: string) => void;
  readonly onRetryMatching?: () => void;
  readonly revealState: "idle" | "submitting" | "error";
  readonly revealStatusVisible: boolean;
  readonly revealError?: string;
  readonly onRevealProgressiveClue: () => void;
  readonly onRetryReveal?: () => void;
  readonly onTimeUp: () => void;
  readonly deadlineAt?: number | null;
  readonly presentedAt?: number | null;
}) {
  const titleId = useId();
  const prompt = splitPrompt(question.question);
  const selected =
    question.type === "multiple-choice" && typeof pendingAnswer === "string" ? pendingAnswer : null;

  return (
    <div className={`${variantStyles.stageFrame} ${styles.stage}`}>
      <GameHeader
        left={
          <p
            className={variantStyles.questionIndicator}
            aria-label={`Pregunta ${questionNumber} de ${totalQuestions}`}
          >
            Pregunta {String(questionNumber).padStart(2, "0")}{" "}
            <span>de {String(totalQuestions).padStart(2, "0")}</span>
          </p>
        }
        timer={
          <Timer
            duration={question.timeLimit}
            active={!locked}
            onTimeUp={onTimeUp}
            resetKey={question.id}
            deadlineAt={deadlineAt ?? undefined}
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
        ) : question.type === "progressive-clues" ? (
          <ServerProgressiveCluesQuestion
            progress={question.progress}
            locked={locked}
            submissionState={submissionState}
            submissionStatusVisible={submissionStatusVisible}
            submissionError={submissionError}
            onRetry={onRetrySubmission}
            revealState={revealState}
            revealStatusVisible={revealStatusVisible}
            revealError={revealError}
            onReveal={onRevealProgressiveClue}
            onRetryReveal={onRetryReveal}
            onSubmit={(answer) => onSubmit(answer)}
          />
        ) : question.type === "matching" ? (
          <ServerMatchingQuestion
            leftItems={question.leftItems}
            rightItems={question.rightItems}
            progress={question.progress}
            locked={locked}
            matchingState={matchingState}
            matchingStatusVisible={matchingStatusVisible}
            matchingError={matchingError}
            lastPair={lastMatchingPair}
            onPair={onMatchingPair}
            onRetry={onRetryMatching}
          />
        ) : question.type === "progressive-image" ? (
          <ProgressiveImageQuestion
            surface={question.surface}
            revealDuration={question.revealDuration}
            answerLabel={question.answerLabel ?? undefined}
            answerPlaceholder={question.answerPlaceholder ?? undefined}
            locked={locked}
            presentedAtMs={presentedAt ?? undefined}
            onTimedResponseStart={() => undefined}
            onSubmit={onSubmit}
          />
        ) : (
          <>
            {question.type === "multiple-choice" && question.media ? (
              <div className="mt-5">
                <QuestionMedia media={question.media} prominent />
              </div>
            ) : null}
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
                    : (submissionError ?? "No hemos podido confirmar tu respuesta.")}
                </p>
                {submissionState === "error" && onRetrySubmission ? (
                  <button type="button" onClick={onRetrySubmission}>
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
