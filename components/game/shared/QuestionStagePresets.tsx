"use client";

import { HeartIcon, NotebookIcon } from "@/components/ui";
import { GameHeader } from "@/components/ui";
import type { QuestionStageProps } from "./QuestionStage";
import { QuestionStage } from "./QuestionStage";
import styles from "./QuestionStageVariants.module.css";

type StagePresetProps = Omit<QuestionStageProps, "renderHeader" | "renderQuestionMeta"> & {
  className?: string;
};

function progressLabel(questionNumber: number, totalQuestions: number) {
  return (
    <>
      Pregunta {String(questionNumber).padStart(2, "0")}{" "}
      <span>de {String(totalQuestions).padStart(2, "0")}</span>
    </>
  );
}

function progressAriaLabel(questionNumber: number, totalQuestions: number) {
  return `Pregunta ${questionNumber} de ${totalQuestions}`;
}

function QuestionIndicator({
  questionNumber,
  totalQuestions,
}: {
  questionNumber: number;
  totalQuestions: number;
}) {
  return (
    <p
      className={styles.questionIndicator}
      aria-label={progressAriaLabel(questionNumber, totalQuestions)}
    >
      {progressLabel(questionNumber, totalQuestions)}
    </p>
  );
}

export function FlashQuestionStage({ className, ...props }: StagePresetProps) {
  return (
    <QuestionStage
      {...props}
      className={`${styles.stageFrame} ${className ?? ""}`}
      renderHeader={({ timer, questionNumber, totalQuestions }) => (
        <GameHeader
          left={
            <QuestionIndicator questionNumber={questionNumber} totalQuestions={totalQuestions} />
          }
          timer={timer}
        />
      )}
    />
  );
}

export type SurvivalQuestionStageProps = StagePresetProps & {
  livesRemaining?: number;
  totalLives?: number;
  notebook?: {
    entryCount: number;
    onOpen: () => void;
  };
};

export function SurvivalQuestionStage({
  className,
  livesRemaining,
  totalLives,
  notebook,
  ...props
}: SurvivalQuestionStageProps) {
  return (
    <QuestionStage
      {...props}
      className={`${styles.stageFrame} ${className ?? ""}`}
      renderHeader={({ timer, questionNumber, totalQuestions }) => (
        <GameHeader
          left={
            <QuestionIndicator questionNumber={questionNumber} totalQuestions={totalQuestions} />
          }
          right={
            <div className={styles.headerActions}>
              {notebook ? <NotebookAction {...notebook} /> : null}
              {typeof livesRemaining === "number" && typeof totalLives === "number" ? (
                <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
              ) : null}
              {timer}
            </div>
          }
        />
      )}
    />
  );
}

export function PyramidQuestionStage({ className, ...props }: StagePresetProps) {
  return (
    <QuestionStage
      {...props}
      className={`${styles.stageFrame} ${className ?? ""}`}
      renderHeader={({ timer, questionNumber, totalQuestions }) => (
        <GameHeader
          left={
            <QuestionIndicator questionNumber={questionNumber} totalQuestions={totalQuestions} />
          }
          timer={timer}
        />
      )}
    />
  );
}

export type LegacyQuestionStageProps = StagePresetProps &
  Pick<SurvivalQuestionStageProps, "livesRemaining" | "totalLives" | "notebook">;

export function LegacyQuestionStage({
  className,
  livesRemaining,
  totalLives,
  notebook,
  ...props
}: LegacyQuestionStageProps) {
  return (
    <QuestionStage
      {...props}
      className={`${styles.legacyStage} ${className ?? ""}`}
      renderHeader={({ timer, questionNumber, totalQuestions }) => (
        <GameHeader
          className=""
          left={
            <QuestionIndicator questionNumber={questionNumber} totalQuestions={totalQuestions} />
          }
          right={
            <div className={styles.headerActions}>
              {notebook ? <NotebookAction {...notebook} /> : null}
              {typeof livesRemaining === "number" && typeof totalLives === "number" ? (
                <LifeHearts livesRemaining={livesRemaining} totalLives={totalLives} />
              ) : null}
              {timer}
            </div>
          }
        />
      )}
    />
  );
}

function NotebookAction({
  entryCount,
  onOpen,
}: NonNullable<SurvivalQuestionStageProps["notebook"]>) {
  return (
    <button
      type="button"
      className={styles.notebookButton}
      onClick={onOpen}
      aria-label={`Abrir cuaderno de campo, ${entryCount} ${entryCount === 1 ? "entrada" : "entradas"}`}
    >
      <NotebookIcon className="h-4 w-4" />
      <span>{entryCount}</span>
    </button>
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
