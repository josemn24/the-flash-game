"use client";
import { CompetitiveQuestionInput } from "@/features/question-formats/competitiveInputRegistry";
import type { CompetitiveInputProps } from "@/features/question-formats/competitiveInputTypes";

import { GameHeader, Timer } from "@/components/ui";
import { type ReactNode, useId } from "react";
import { LifeHearts } from "./LifeHearts";
import styles from "./QuestionStage.module.css";
import variantStyles from "./QuestionStageVariants.module.css";

function splitPrompt(prompt: string) {
  const index = prompt.lastIndexOf("¿");
  return index > 0
    ? { context: prompt.slice(0, index).trim(), title: prompt.slice(index).trim() }
    : { title: prompt };
}

export function ServerFlashQuestionStage(
  props: CompetitiveInputProps & {
    readonly showHeader?: boolean;
    readonly titleOverride?: string;
    readonly supportingText?: string;
  },
) {
  const {
    question,
    questionNumber,
    totalQuestions,
    locked,
    onTimeUp,
    deadlineAt,
    livesRemaining,
    totalLives,
    presentation,
    showTimer = true,
    showHeader = true,
    titleOverride,
    supportingText,
    ...inputProps
  } = props;

  const pyramidPresentation = presentation === "pyramid";
  const structuredPresentation = pyramidPresentation || presentation === "time-trial";
  const prompt = pyramidPresentation
    ? { title: question.question }
    : splitPrompt(question.question);

  const timer = (
    <Timer
      duration={question.timeLimit}
      active={!locked}
      onTimeUp={onTimeUp}
      resetKey={question.id}
      deadlineAt={deadlineAt ?? undefined}
      size={pyramidPresentation ? "default" : "compact"}
    />
  );

  return (
    <div
      className={`${variantStyles.stageFrame} ${styles.stage} ${structuredPresentation ? styles.embeddedStage : ""}`}
    >
      {showHeader ? (
        pyramidPresentation ? (
          <>
            <GameHeader
              title="La Pirámide"
              timer={showTimer ? timer : undefined}
              mobileLabel={
                <>
                  Nivel {questionNumber} <span>de {totalQuestions}</span>
                </>
              }
              mobileLabelAriaLabel={`Nivel ${questionNumber} de ${totalQuestions}`}
            />
            <p
              className={variantStyles.pyramidLevelIndicator}
              aria-label={`Nivel ${questionNumber} de ${totalQuestions}`}
            >
              Nivel {questionNumber} <span>de {totalQuestions}</span>
            </p>
          </>
        ) : (
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
            timer={showTimer ? timer : undefined}
            right={
              typeof livesRemaining === "number" && typeof totalLives === "number" ? (
                <div className={variantStyles.headerActions}>
                  <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
                  {showTimer ? timer : null}
                </div>
              ) : undefined
            }
          />
        )
      ) : null}
      <ServerQuestionPanel
        title={titleOverride ?? prompt.title}
        context={prompt.context}
        supportingText={supportingText}
        variant={structuredPresentation ? "structured" : "default"}
      >
        <CompetitiveQuestionInput
          {...inputProps}
          question={question}
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          locked={locked}
          onTimeUp={onTimeUp}
          deadlineAt={deadlineAt}
          presentation={presentation}
          showTimer={showTimer}
        />
      </ServerQuestionPanel>
    </div>
  );
}

function ServerQuestionPanel({
  title,
  context,
  supportingText,
  children,
  variant = "default",
}: {
  title: string;
  context?: string;
  supportingText?: string;
  children: ReactNode;
  variant?: "default" | "structured";
}) {
  const titleId = useId();
  return (
    <section
      className={`${styles.questionCard} ${variant === "structured" ? styles.structuredQuestionCard : ""}`}
      aria-labelledby={titleId}
    >
      {context ? <p className={styles.promptContext}>{context}</p> : null}
      <h1 id={titleId}>{title}</h1>
      {supportingText ? <p className={styles.promptSupportingText}>{supportingText}</p> : null}
      {children}
    </section>
  );
}
