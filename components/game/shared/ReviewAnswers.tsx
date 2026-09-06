"use client";

import { motion } from "motion/react";
import {
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  CrossIcon,
  NotebookIcon,
  RotateIcon,
} from "@/components/ui";
import { Logo } from "@/components/navigation/Logo";
import styles from "./ReviewAnswers.module.css";
import { GameHeader, MotionButton } from "@/components/ui";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import type {
  AnswerResult,
  FlashChallenge,
  NarrativeChallenge,
  PyramidChallenge,
  SurvivalChallenge,
} from "@/types/game";

function statusLabel(result: AnswerResult) {
  if (result.status === "correct") return "Correcta";
  if (result.status === "partial") return "Parcial";
  if (result.status === "incorrect") return "Incorrecta";
  return "Sin contestar";
}

export function ReviewAnswers({
  challenge,
  results,
  onBack,
  onReplay,
  notebook,
  variant = "legacy",
}: {
  challenge: FlashChallenge | SurvivalChallenge | NarrativeChallenge | PyramidChallenge;
  results: AnswerResult[];
  onBack: () => void;
  onReplay?: () => void;
  notebook?: { entryCount: number; onOpen: () => void };
  variant?: "legacy" | "flash-pop";
}) {
  const questions =
    challenge.mode === "narrative"
      ? challenge.beats.flatMap((beat) =>
          beat.steps.flatMap((step) => (step.type === "question" ? [step.question] : [])),
        )
      : challenge.mode === "pyramid"
        ? challenge.levels.map((level) => level.question)
        : challenge.questions;
  const narrative = challenge.mode === "narrative";

  return (
    <motion.section
      data-variant={variant}
      className="mx-auto min-h-[100dvh] w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <GameHeader
        className="mb-9"
        left={<Logo />}
        right={
          <div className="flex items-center gap-3">
            {notebook && (
              <motion.button
                type="button"
                className={styles.textButton}
                onClick={notebook.onOpen}
                whileTap={{ scale: 0.98 }}
                aria-label={`Abrir cuaderno de campo, ${notebook.entryCount} entradas`}
              >
                <NotebookIcon className="h-4 w-4" />
                Cuaderno · {notebook.entryCount}
              </motion.button>
            )}
            <motion.button
              type="button"
              className={styles.textButton}
              onClick={onBack}
              whileTap={{ scale: 0.98 }}
            >
              Volver al resultado
            </motion.button>
          </div>
        }
      />

      <div className="mb-7 sm:mb-9">
        <p className={`${styles.eyebrow} text-[var(--color-brand)]`}>
          {narrative ? "Análisis de misión" : "Análisis de carrera"}
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[var(--color-ink)] sm:text-5xl">
          Revisa tus respuestas
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--color-ink-muted)]">
          {narrative
            ? "Contrasta tus respuestas con el registro científico y consulta el cuaderno completo."
            : "Aquí sí: descubre qué acertaste, dónde fallaste y cuánto sumó cada decisión."}
        </p>
      </div>

      <div className="space-y-3">
        {questions.map((question, index) => {
          const result = results.find((item) => item.questionId === question.id);
          if (!result) return null;
          const correct = result.status === "correct";
          const partial = result.status === "partial";
          const unanswered = result.status === "unanswered";
          const logicDetails = result.details?.type === "logic-code" ? result.details : undefined;
          const estimationDetails =
            result.details?.type === "estimation" ? result.details : undefined;
          const matchingDetails = result.details?.type === "matching" ? result.details : undefined;

          return (
            <motion.details
              key={question.id}
              className={`${styles.reviewCard} ${correct ? styles.reviewCorrect : partial ? styles.reviewPartial : unanswered ? styles.reviewUnanswered : styles.reviewWrong}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.035, 0.3) }}
            >
              <summary>
                <span className={styles.reviewNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 block font-mono text-[9px] font-black tracking-[0.15em] text-[var(--color-ink-faint)] uppercase">
                    {question.category}
                  </span>
                  <span className="block text-sm font-bold leading-5 text-[var(--color-ink)] sm:text-base">
                    {question.question}
                  </span>
                </span>
                <span
                  className={`${styles.reviewStatus} ${correct ? styles.statusCorrect : partial ? styles.statusPartial : unanswered ? styles.statusUnanswered : styles.statusWrong}`}
                >
                  {correct || partial ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : unanswered ? (
                    <ClockIcon className="h-4 w-4" />
                  ) : (
                    <CrossIcon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{statusLabel(result)}</span>
                </span>
                <ChevronIcon
                  className={`${styles.reviewChevron} h-5 w-5 text-[var(--color-ink-faint)]`}
                />
              </summary>

              <div className={styles.reviewContent}>
                <QuestionReviewContent question={question} result={result} />
                <div className="mt-3 rounded-xl bg-[var(--color-surface-raised)] p-4">
                  <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                    {question.explanation}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-4 font-mono text-[10px] font-bold tracking-wide uppercase">
                  <span className="text-[var(--color-ink-faint)]">
                    Tiempo: {result.timeUsed.toFixed(1)} s
                  </span>
                  {logicDetails && (
                    <span className="text-[var(--color-ink-faint)]">
                      Intentos: {logicDetails.submittedCodes.length}
                    </span>
                  )}
                  {estimationDetails && (
                    <span className="text-[var(--color-social)]">
                      Cercanía: {Math.round(estimationDetails.proximity * 100)}%
                    </span>
                  )}
                  {matchingDetails && (
                    <>
                      <span className="text-[var(--color-social)]">
                        Parejas: {matchingDetails.correctPairs}/{matchingDetails.totalPairs}
                      </span>
                      <span className="text-[var(--color-ink-faint)]">
                        Fallos: {matchingDetails.incorrectAttempts}
                      </span>
                    </>
                  )}
                  <span
                    className={
                      result.points > 0
                        ? "text-[var(--color-brand)]"
                        : result.points < 0
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-ink-faint)]"
                    }
                  >
                    {result.points > 0 ? "+" : ""}
                    {result.points} pts
                  </span>
                </div>
              </div>
            </motion.details>
          );
        })}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <MotionButton variant="secondary" onClick={onBack} whileTap={{ scale: 0.98 }}>
          Volver al resultado
        </MotionButton>
        {onReplay && (
          <MotionButton onClick={onReplay} whileTap={{ scale: 0.98 }}>
            <RotateIcon className="h-5 w-5" />
            {variant === "flash-pop" ? "Jugar de nuevo" : "Volver a jugar"}
          </MotionButton>
        )}
      </div>
    </motion.section>
  );
}
