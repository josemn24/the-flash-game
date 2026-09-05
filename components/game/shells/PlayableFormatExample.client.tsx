"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CrossIcon, RotateIcon } from "@/components/ui";
import styles from "./PlayableFormatExample.module.css";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import { Chip, MotionButton, Timer } from "@/components/ui";
import { QuestionInput } from "@/features/question-formats/QuestionInput";
import { QuestionReviewContent } from "@/features/question-formats/QuestionReviewContent";
import { evaluateAnswer, getTimedOutAnswer, isAnswerCorrect } from "@/lib/scoring";
import type { AnswerResult, AnswerValue, Question } from "@/types/game";

type ExamplePhase = "ready" | "playing" | "feedback";

const RESULT_LABELS = {
  correct: "Respuesta correcta",
  partial: "Crédito parcial",
  incorrect: "Respuesta incorrecta",
  unanswered: "Tiempo agotado",
} as const;

function resultLabel(question: Question, result: AnswerResult) {
  if (question.type === "pipes" && result.status === "partial") return "Red incompleta";
  return RESULT_LABELS[result.status];
}

function hasDelayedTimedResponse(question: Question) {
  return (
    question.type === "flash-memory" ||
    question.type === "simon-sequence" ||
    question.type === "mini-wordle" ||
    question.type === "progressive-image"
  );
}

export function PlayableFormatExample({
  title,
  question,
  rules,
}: {
  title: string;
  question: Question;
  rules: string[];
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const startedAtRef = useRef(0);
  const answerLockRef = useRef(false);
  const codeAttemptsRef = useRef<string[]>([]);
  const draftAnswerRef = useRef<AnswerValue | null>(null);
  const incorrectAttemptsRef = useRef(0);
  const progressiveCluesRevealedRef = useRef(1);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ExamplePhase>("ready");
  const [attempt, setAttempt] = useState(0);
  const [codeAttemptCount, setCodeAttemptCount] = useState(0);
  const [timedResponseStarted, setTimedResponseStarted] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const resetAttempt = useCallback(() => {
    answerLockRef.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    setCodeAttemptCount(0);
    setTimedResponseStarted(false);
    setResult(null);
    setPhase("ready");
  }, []);

  const openExample = () => {
    resetAttempt();
    setOpen(true);
    dialogRef.current?.showModal();
  };

  const closeExample = () => {
    dialogRef.current?.close();
  };

  const handleDialogClosed = () => {
    setOpen(false);
    resetAttempt();
  };

  const startAttempt = () => {
    answerLockRef.current = false;
    codeAttemptsRef.current = [];
    draftAnswerRef.current = null;
    incorrectAttemptsRef.current = 0;
    progressiveCluesRevealedRef.current = 1;
    setCodeAttemptCount(0);
    setTimedResponseStarted(false);
    setResult(null);
    setAttempt((current) => current + 1);
    startedAtRef.current = performance.now();
    setPhase("playing");
  };

  const submitAnswer = useCallback(
    (answer: AnswerValue | null, timedOut = false, submittedCodes?: string[]) => {
      if (answerLockRef.current || phase !== "playing") return;
      answerLockRef.current = true;

      const timeUsed = timedOut
        ? question.timeLimit
        : (performance.now() - startedAtRef.current) / 1000;

      setResult(
        evaluateAnswer({
          question,
          answer,
          timeUsed,
          timedOut,
          submittedCodes: submittedCodes ?? codeAttemptsRef.current,
          incorrectAttempts: incorrectAttemptsRef.current,
          matchingIncorrectAttempts: incorrectAttemptsRef.current,
          progressiveCluesRevealed: progressiveCluesRevealedRef.current,
        }),
      );
      setPhase("feedback");
    },
    [phase, question],
  );

  const handleCodeAttempt = useCallback(
    (code: string) => {
      if (answerLockRef.current || phase !== "playing" || question.type !== "logic-code") {
        return false;
      }

      const attempts = [...codeAttemptsRef.current, code];
      codeAttemptsRef.current = attempts;
      setCodeAttemptCount(attempts.length);
      const correct = isAnswerCorrect(question, code);
      if (correct) submitAnswer(code, false, attempts);
      return correct;
    },
    [phase, question, submitAnswer],
  );

  const handleTimeUp = useCallback(() => {
    const submittedCodes = codeAttemptsRef.current;
    submitAnswer(
      getTimedOutAnswer(question, {
        draftAnswer: draftAnswerRef.current,
        submittedCodes,
      }),
      true,
      submittedCodes,
    );
  }, [question, submitAnswer]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.launcher}>
        <span className={styles.launcherTitle}>{title}</span>
        <div className={styles.launcherMeta}>
          <Chip>{question.category}</Chip>
          <span>
            {question.timeLimit} s · {question.points} pts
          </span>
        </div>
        <h3>{question.question}</h3>
        <p>Responde con las mismas reglas, tiempo y puntuación que en un desafío real.</p>
        <MotionButton
          className={styles.launchButton}
          onClick={openExample}
          whileTap={{ scale: 0.985 }}
        >
          Probar este formato
        </MotionButton>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={handleDialogClosed}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeExample();
        }}
      >
        <div className={styles.dialogSurface}>
          <header className={styles.dialogHeader}>
            <div>
              <span className={styles.dialogEyebrow}>Ejemplo jugable</span>
              <strong>{question.category}</strong>
            </div>
            <button
              className={styles.closeButton}
              type="button"
              onClick={closeExample}
              aria-label="Cerrar ejemplo"
            >
              <CrossIcon className="h-5 w-5" />
            </button>
          </header>

          {phase === "ready" && (
            <div className={styles.readyPanel}>
              <Chip>{question.category}</Chip>
              <h2 id={titleId}>{question.question}</h2>
              <p>
                {question.type === "mini-wordle" ? (
                  <>
                    Primero se cargará el diccionario. Tendrás{" "}
                    <strong>{question.timeLimit} segundos</strong> para responder cuando esté listo.
                  </>
                ) : question.type === "progressive-image" ? (
                  <>
                    Primero se cargará la imagen. Tendrás{" "}
                    <strong>{question.timeLimit} segundos</strong> para identificarla cuando
                    comience a revelarse.
                  </>
                ) : hasDelayedTimedResponse(question) ? (
                  <>
                    Primero se reproducirá la secuencia. Tendrás{" "}
                    <strong>{question.timeLimit} segundos</strong> para responder cuando termine.
                  </>
                ) : (
                  <>
                    Tendrás <strong>{question.timeLimit} segundos</strong>. El tiempo empezará
                    cuando pulses el botón.
                  </>
                )}
              </p>
              <ul className={styles.readyRules}>
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <MotionButton size="hero" onClick={startAttempt} whileTap={{ scale: 0.985 }}>
                Empezar ejemplo
              </MotionButton>
            </div>
          )}

          {phase === "playing" && (
            <div className={styles.playPanel} key={attempt}>
              <div className={styles.questionHeader}>
                <Chip>{question.category}</Chip>
                {!hasDelayedTimedResponse(question) || timedResponseStarted ? (
                  <Timer
                    key={`timer-${attempt}`}
                    duration={question.timeLimit}
                    active={!hasDelayedTimedResponse(question) || timedResponseStarted}
                    onTimeUp={handleTimeUp}
                  />
                ) : null}
              </div>
              <h2 id={titleId} className={styles.questionTitle}>
                {question.question}
              </h2>
              {"media" in question && question.media && (
                <div className={styles.questionMedia}>
                  <QuestionMedia media={question.media} />
                </div>
              )}
              <QuestionInput
                key={`input-${attempt}`}
                question={question}
                variant="flash-pop"
                locked={false}
                onSubmit={submitAnswer}
                codeAttemptCount={codeAttemptCount}
                onCodeAttempt={handleCodeAttempt}
                onProgress={(answer) => {
                  draftAnswerRef.current = answer;
                }}
                onIncorrectAttempt={() => {
                  incorrectAttemptsRef.current += 1;
                }}
                onProgressiveClueReveal={(revealedClues) => {
                  progressiveCluesRevealedRef.current = revealedClues;
                }}
                onTimedResponseStart={() => {
                  startedAtRef.current = performance.now();
                  setTimedResponseStarted(true);
                }}
              />
            </div>
          )}

          {phase === "feedback" && result && (
            <div className={styles.feedbackPanel}>
              <div className={`${styles.resultBanner} ${styles[result.status]}`}>
                <span>{resultLabel(question, result)}</span>
                <strong>{result.points > 0 ? `+${result.points}` : result.points} pts</strong>
                <small>{result.timeUsed.toFixed(1)} s</small>
              </div>
              <h2 id={titleId}>Resultado del ejemplo</h2>
              <QuestionReviewContent question={question} result={result} />
              <div className={styles.explanation}>
                <span>Solución comentada</span>
                <p>{question.explanation}</p>
              </div>
              <div className={styles.feedbackActions}>
                <MotionButton
                  variant="secondary"
                  onClick={closeExample}
                  whileTap={{ scale: 0.985 }}
                >
                  Cerrar
                </MotionButton>
                <MotionButton onClick={startAttempt} whileTap={{ scale: 0.985 }}>
                  <RotateIcon className="h-5 w-5" />
                  Reintentar
                </MotionButton>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </MotionConfig>
  );
}
