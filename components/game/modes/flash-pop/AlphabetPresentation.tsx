"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowIcon,
  Button,
  Card,
  CheckIcon,
  CrossIcon,
  GameHeader,
  RotateIcon,
} from "@/components/ui";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ReviewAnswerPanel } from "@/components/game/shared";
import type { ReviewAnswerEntry } from "@/components/game/shared/ReviewAnswerList";
import styles from "./FlashPopAlphabetGame.module.css";

export type AlphabetPresentationLetter = {
  letter: string;
  status: "unvisited" | "active" | "passed" | "correct" | "incorrect" | "unanswered";
};

export type AlphabetPresentationQuestion = {
  id: string;
  question: string;
  answerPlaceholder?: string | null;
};

export type AlphabetPresentationFeedback = {
  id: string;
  isCorrect: boolean;
  eyebrow: string;
  body: string;
};

const STATUS_LABELS: Record<AlphabetPresentationLetter["status"], string> = {
  unvisited: "Sin visitar",
  active: "Activa",
  passed: "Pasada",
  correct: "Correcta",
  incorrect: "Incorrecta",
  unanswered: "Sin responder",
};

function AlphabetBoard({ letters }: { letters: readonly AlphabetPresentationLetter[] }) {
  return (
    <div
      className={`${styles.board} ${styles.boardCompact}`}
      role="list"
      aria-label="Estado de las letras"
    >
      {letters.map((item, index) => (
        <div
          key={item.letter}
          className={`${styles.letterCell} ${styles[`status_${item.status}`]}`}
          style={{ "--letter-index": index, "--letter-count": letters.length } as CSSProperties}
          role="listitem"
          aria-label={`${item.letter}: ${STATUS_LABELS[item.status]}`}
        >
          <span>{item.letter}</span>
          {item.status === "correct" ? <CheckIcon className={styles.markIcon} /> : null}
          {item.status === "incorrect" ? <CrossIcon className={styles.markIcon} /> : null}
          {item.status === "passed" ? <span className={styles.passMark}>↻</span> : null}
          {item.status === "unanswered" ? <span className={styles.emptyMark}>—</span> : null}
        </div>
      ))}
    </div>
  );
}

function AlphabetAnswerForm({
  question,
  locked,
  busy,
  onSubmit,
  onPass,
}: {
  question: AlphabetPresentationQuestion;
  locked: boolean;
  busy: boolean;
  onSubmit: (answer: string) => void;
  onPass: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (answer.trim() && !locked && !busy) onSubmit(answer);
  };

  return (
    <form className={styles.answerForm} onSubmit={submit}>
      <label htmlFor={`flash-pop-alphabet-answer-${question.id}`}>Tu respuesta</label>
      <input
        ref={inputRef}
        id={`flash-pop-alphabet-answer-${question.id}`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={locked || busy}
        autoComplete="off"
        enterKeyHint="send"
        placeholder={question.answerPlaceholder ?? "Escribe tu respuesta…"}
      />
      <div className={styles.answerActions}>
        <Button
          variant="secondary"
          type="button"
          className={styles.passButton}
          onClick={onPass}
          disabled={locked || busy}
          trailingIcon={<RotateIcon />}
        >
          Pasar
        </Button>
        <Button
          type="submit"
          disabled={locked || busy || !answer.trim()}
          trailingIcon={<ArrowIcon />}
        >
          Responder
        </Button>
      </div>
      <p>No importan las mayúsculas ni las tildes.</p>
    </form>
  );
}

export function AlphabetPlayingPresentation({
  round,
  correctAnswers,
  totalLetters,
  timer,
  letters,
  question,
  locked,
  busy = false,
  error,
  feedback,
  onSubmit,
  onPass,
}: {
  round: number;
  correctAnswers: number;
  totalLetters: number;
  timer: ReactNode;
  letters: readonly AlphabetPresentationLetter[];
  question: AlphabetPresentationQuestion | null;
  locked: boolean;
  busy?: boolean;
  error?: string;
  feedback?: AlphabetPresentationFeedback;
  onSubmit: (answer: string) => void;
  onPass: () => void;
}) {
  const feedbackId = feedback?.id ?? null;
  const [hiddenFeedbackId, setHiddenFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackId) return;

    const timeout = window.setTimeout(() => setHiddenFeedbackId(feedbackId), 1_350);
    return () => window.clearTimeout(timeout);
  }, [feedbackId]);

  const feedbackVisible = feedback !== undefined && hiddenFeedbackId !== feedbackId;

  return (
    <div className={styles.playing}>
      <GameHeader
        title="Alfabeto"
        mobileLabel={`Vuelta ${round}`}
        right={
          <div className={styles.gameMeta}>
            <span>Vuelta {round}</span>
            <span>
              <strong>{correctAnswers}</strong> / {totalLetters}
            </span>
            {timer}
          </div>
        }
      />
      <div className={styles.playGrid}>
        <Card className={styles.boardCard}>
          <AlphabetBoard letters={letters} />
        </Card>
        <section className={styles.questionPanel} aria-labelledby="alphabet-question-title">
          <h1 id="alphabet-question-title">{question?.question ?? "Preparando…"}</h1>
          {question ? (
            <AlphabetAnswerForm
              key={question.id}
              question={question}
              locked={locked || feedbackVisible}
              busy={busy}
              onSubmit={onSubmit}
              onPass={onPass}
            />
          ) : null}
          {error ? (
            <p className={styles.serverMessage} role="alert">
              {error}
            </p>
          ) : null}
          {feedbackVisible && feedback ? <AlphabetFeedback feedback={feedback} /> : null}
        </section>
      </div>
    </div>
  );
}

function AlphabetFeedback({ feedback }: { feedback: AlphabetPresentationFeedback }) {
  return (
    <div className={styles.inlineFeedback}>
      <FlashPopFeedback
        status={feedback.isCorrect ? "correct" : "incorrect"}
        variant="inline"
        eyebrow={feedback.eyebrow}
        title={feedback.isCorrect ? "Correcto" : "Casi."}
        body={feedback.body}
      />
    </div>
  );
}

export function AlphabetReviewPresentation({
  entries,
  onBack,
  onReplay,
}: {
  entries: ReviewAnswerEntry[];
  onBack: () => void;
  onReplay?: () => void;
}) {
  return (
    <div className={styles.stage}>
      <GameHeader title="Alfabeto" />
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${entries.length} respuestas`}
        title="Historial de respuestas"
        description="Consulta tu respuesta, la solución aceptada y la explicación de cada letra."
        onBack={onBack}
        onReplay={onReplay}
      />
    </div>
  );
}
