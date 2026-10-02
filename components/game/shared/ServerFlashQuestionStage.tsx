"use client";
import { CompetitiveQuestionInput } from "@/features/question-formats/competitiveInputRegistry";
import type { CompetitiveInputProps } from "@/features/question-formats/competitiveInputTypes";

import { GameHeader, Timer } from "@/components/ui";
import { useId } from "react";
import { LifeHearts } from "./LifeHearts";
import styles from "./QuestionStage.module.css";
import variantStyles from "./QuestionStageVariants.module.css";

function splitPrompt(prompt: string) {
  const index = prompt.lastIndexOf("¿");
  return index > 0
    ? { context: prompt.slice(0, index).trim(), title: prompt.slice(index).trim() }
    : { title: prompt };
}

export function ServerFlashQuestionStage(props: CompetitiveInputProps) {
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
  } = props;

  const titleId = useId();
  const pyramidPresentation = presentation === "pyramid";
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
      className={`${variantStyles.stageFrame} ${styles.stage} ${pyramidPresentation ? styles.pyramidStage : ""}`}
    >
      {pyramidPresentation ? (
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
          timer={timer}
          right={
            typeof livesRemaining === "number" && typeof totalLives === "number" ? (
              <div className={variantStyles.headerActions}>
                <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
                {timer}
              </div>
            ) : undefined
          }
        />
      )}
      <section
        className={`${styles.questionCard} ${pyramidPresentation ? styles.pyramidQuestionCard : ""}`}
        aria-labelledby={titleId}
      >
        {prompt.context ? <p className={styles.promptContext}>{prompt.context}</p> : null}
        <h1 id={titleId}>{prompt.title}</h1>
        {<CompetitiveQuestionInput {...props} />}
      </section>
    </div>
  );
}
