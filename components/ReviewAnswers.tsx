"use client";

import { motion } from "motion/react";
import { CheckIcon, ChevronIcon, ClockIcon, CrossIcon, RotateIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import styles from "@/components/ReviewAnswers.module.css";
import { isClassificationAnswer } from "@/lib/scoring";
import type { AnswerResult, AnswerValue, Stage } from "@/types/game";

function answerLabel(value: AnswerValue | null) {
  if (value === null) return "Sin respuesta";
  if (Array.isArray(value)) return value.join(" → ");
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  if (typeof value === "object") return "Clasificación completada";
  return value;
}

function categoryLabel(category: string | undefined) {
  if (!category) return "Sin respuesta";
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

function statusLabel(result: AnswerResult) {
  if (result.status === "correct") return "Correcta";
  if (result.status === "partial") return "Aproximada";
  if (result.status === "incorrect") return "Incorrecta";
  return "Sin contestar";
}

export function ReviewAnswers({
  stage,
  results,
  onBack,
  onReplay,
}: {
  stage: Stage;
  results: AnswerResult[];
  onBack: () => void;
  onReplay: () => void;
}) {
  return (
    <motion.section
      className="mx-auto min-h-[100dvh] w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <AppHeader
        className="mb-9"
        left={<Logo />}
        right={
          <motion.button
            type="button"
            className={styles.textButton}
            onClick={onBack}
            whileTap={{ scale: 0.98 }}
          >
            Volver al resultado
          </motion.button>
        }
      />

      <div className="mb-7 sm:mb-9">
        <p className={`${styles.eyebrow} text-[var(--electric)]`}>Análisis de carrera</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
          Revisa tus respuestas
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
          Aquí sí: descubre qué acertaste, dónde fallaste y cuánto sumó cada decisión.
        </p>
      </div>

      <div className="space-y-3">
        {stage.questions.map((question, index) => {
          const result = results.find((item) => item.questionId === question.id);
          if (!result) return null;
          const correct = result.status === "correct";
          const partial = result.status === "partial";
          const unanswered = result.status === "unanswered";
          const classificationAnswer =
            question.type === "classification" && isClassificationAnswer(result.answer)
              ? result.answer
              : null;

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
                  <span className="mb-1 block font-mono text-[9px] font-black tracking-[0.15em] text-white/35 uppercase">
                    {question.category}
                  </span>
                  <span className="block text-sm font-bold leading-5 text-white sm:text-base">
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
                <ChevronIcon className={`${styles.reviewChevron} h-5 w-5 text-white/25`} />
              </summary>

              <div className={styles.reviewContent}>
                {question.type === "estimation" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={styles.answerBox}>
                      <span>Tu estimación</span>
                      <strong>
                        {typeof result.answer === "number"
                          ? `${result.answer} ${question.unit}`
                          : "Sin respuesta"}
                      </strong>
                    </div>
                    <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
                      <span>Valor real</span>
                      <strong>{question.correctAnswer} {question.unit}</strong>
                    </div>
                    <div className={styles.answerBox}>
                      <span>Diferencia</span>
                      <strong>
                        {typeof result.answer !== "number" || result.difference === undefined
                          ? "—"
                          : result.difference === 0
                            ? "Exacta"
                            : `${result.difference} ${question.unit} ${result.answer > question.correctAnswer ? "por encima" : "por debajo"}`}
                      </strong>
                    </div>
                  </div>
                ) : question.type === "logic-code" ? (
                  <div>
                    <div className={styles.logicReviewClues}>
                      {question.clues.map((clue) => (
                        <div key={clue.code}>
                          <strong>{clue.code}</strong>
                          <span>{clue.hint}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className={styles.answerBox}>
                        <span>Códigos enviados</span>
                        {result.submittedCodes?.length ? (
                          <div className={styles.logicReviewAttempts}>
                            {result.submittedCodes.map((code, attemptIndex) => (
                              <b
                                key={`${code}-${attemptIndex}`}
                                className={
                                  attemptIndex === result.submittedCodes!.length - 1
                                    ? styles.logicReviewLast
                                    : ""
                                }
                              >
                                {code}
                              </b>
                            ))}
                          </div>
                        ) : (
                          <strong>Sin respuesta</strong>
                        )}
                      </div>
                      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
                        <span>Solución</span>
                        <strong>{question.correctAnswer}</strong>
                      </div>
                    </div>
                  </div>
                ) : question.type === "classification" ? (
                  <div className={styles.classificationReviewList}>
                    {question.items.map((item) => {
                      const chosenCategory = classificationAnswer?.[item.label];
                      const itemCorrect = chosenCategory === item.correctCategory;

                      return (
                        <div key={item.label} className={styles.classificationReviewRow}>
                          <strong>{item.label}</strong>
                          <span>
                            <small>Elegida</small>
                            <b
                              className={
                                itemCorrect
                                  ? styles.classificationValueCorrect
                                  : styles.classificationValueWrong
                              }
                            >
                              {categoryLabel(chosenCategory)}
                            </b>
                          </span>
                          <span>
                            <small>Correcta</small>
                            <b className={styles.classificationValueCorrect}>
                              {categoryLabel(item.correctCategory)}
                            </b>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={styles.answerBox}>
                      <span>Tu respuesta</span>
                      <strong>{answerLabel(result.answer)}</strong>
                    </div>
                    <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
                      <span>Respuesta correcta</span>
                      <strong>
                        {answerLabel(
                          question.type === "ordering"
                            ? question.correctOrder
                            : question.correctAnswer,
                        )}
                      </strong>
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-xl bg-white/[0.035] p-4">
                  <p className="text-sm leading-6 text-white/55">{question.explanation}</p>
                </div>
                <div className="mt-3 flex items-center gap-4 font-mono text-[10px] font-bold tracking-wide uppercase">
                  <span className="text-white/35">Tiempo: {result.timeUsed.toFixed(1)} s</span>
                  {question.type === "logic-code" && (
                    <span className="text-white/35">
                      Intentos: {result.submittedCodes?.length ?? 0}
                    </span>
                  )}
                  {question.type === "estimation" && result.proximity !== undefined && (
                    <span className="text-[var(--cyan)]">
                      Cercanía: {Math.round(result.proximity * 100)}%
                    </span>
                  )}
                  <span
                    className={
                      result.points > 0
                        ? "text-[var(--electric)]"
                        : result.points < 0
                          ? "text-[var(--coral)]"
                          : "text-white/35"
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
        <Button variant="secondary" onClick={onBack} whileTap={{ scale: 0.98 }}>
          Volver al resultado
        </Button>
        <Button onClick={onReplay} whileTap={{ scale: 0.98 }}>
          <RotateIcon className="h-5 w-5" />
          Volver a jugar
        </Button>
      </div>
    </motion.section>
  );
}
