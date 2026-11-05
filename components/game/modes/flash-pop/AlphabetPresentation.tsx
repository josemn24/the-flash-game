"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Card, CheckIcon, CrossIcon, GameHeader } from "@/components/ui";
import {
  formatAlphabetProgress,
  getAlphabetNavigation,
  type AlphabetNavigationLetter,
} from "@/features/flash-pop/alphabetNavigation";
import { FlashPopFeedback } from "@/components/game/modes/flash-pop/FlashPopFeedback";
import { ReviewAnswerPanel } from "@/components/game/shared";
import type { ReviewAnswerEntry } from "@/components/game/shared/ReviewAnswerList";
import {
  AlphabetAnswerEditor,
  AlphabetAnswerDock,
  type AlphabetEditorElement,
  type AlphabetKeyboardMode,
} from "./AlphabetAnswerEditor.client";
import styles from "./FlashPopAlphabetGame.module.css";

export type AlphabetPresentationLetter = AlphabetNavigationLetter;

export type AlphabetPresentationQuestion = {
  id: string;
  question: string;
  answerPlaceholder?: string | null;
  answerLength?: number | null;
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

function LetterCell({
  item,
  current = false,
}: {
  item: AlphabetPresentationLetter;
  current?: boolean;
}) {
  return (
    <div
      className={`${styles.letterCell} ${styles[`status_${item.status}`]}`}
      role="listitem"
      aria-current={current ? "step" : undefined}
      aria-label={`${item.letter}: ${STATUS_LABELS[item.status]}`}
    >
      <span>{item.letter}</span>
      {item.status === "correct" ? (
        <CheckIcon aria-hidden="true" className={styles.markIcon} />
      ) : null}
      {item.status === "incorrect" ? (
        <CrossIcon aria-hidden="true" className={styles.markIcon} />
      ) : null}
      {item.status === "passed" ? (
        <span aria-hidden="true" className={styles.passMark}>
          ↻
        </span>
      ) : null}
      {item.status === "unanswered" ? (
        <span aria-hidden="true" className={styles.emptyMark}>
          —
        </span>
      ) : null}
    </div>
  );
}

function AlphabetBoard({
  letters,
  currentIndex,
}: {
  letters: readonly AlphabetPresentationLetter[];
  currentIndex: number | null;
}) {
  return (
    <div className={styles.board} role="list" aria-label="Estado de las letras">
      {letters.map((item, index) => (
        <LetterCell key={item.letter} item={item} current={index === currentIndex} />
      ))}
    </div>
  );
}

export function AlphabetPlayingPresentation({
  round,
  currentIndex,
  answerVisitKey,
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
  currentIndex: number | null;
  answerVisitKey: string | null;
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
  const navigation = getAlphabetNavigation(letters, currentIndex, null);
  const progressLabel = formatAlphabetProgress(
    navigation.correctAnswers,
    navigation.incorrectAnswers,
    navigation.pendingLetters,
  );
  const editorRef = useRef<AlphabetEditorElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState({
    visitKey: question ? answerVisitKey : null,
    value: "",
  });
  // Start each prepared visit empty; ordinary updates preserve the user's draft.
  if (question && answerVisitKey !== null && answerVisitKey !== draft.visitKey) {
    setDraft({ visitKey: answerVisitKey, value: "" });
  }
  const [keyboardMode, setKeyboardMode] = useState<AlphabetKeyboardMode>("game");
  const [keyboardLayout, setKeyboardLayout] = useState({ compact: false, expanded: false });
  const actionPending = useRef(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      frameRef.current?.style.setProperty(
        "--alphabet-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      frameRef.current?.style.setProperty(
        "--alphabet-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      const compact = (viewport?.height ?? window.innerHeight) <= 640;
      setKeyboardLayout((previous) =>
        previous.compact === compact ? previous : { compact, expanded: false },
      );
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const feedbackId = feedback?.id ?? null;
  const [hiddenFeedbackId, setHiddenFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackId) return;

    const timeout = window.setTimeout(() => setHiddenFeedbackId(feedbackId), 1_350);
    return () => window.clearTimeout(timeout);
  }, [feedbackId]);

  const feedbackVisible = feedback !== undefined && hiddenFeedbackId !== feedbackId;

  const editingDisabled = locked || busy || feedbackVisible || !question;
  const disabled = editingDisabled;
  useEffect(() => {
    if (!editingDisabled) actionPending.current = false;
  }, [editingDisabled, answerVisitKey, error]);
  const submit = () => {
    if (!disabled && !actionPending.current && draft.value.trim()) {
      actionPending.current = true;
      onSubmit(draft.value);
    }
  };
  const changeAnswer = (value: string) => {
    if (!disabled) setDraft((previous) => ({ ...previous, value }));
  };

  return (
    <form
      ref={frameRef}
      className={`${styles.playing} ${keyboardLayout.compact ? styles.compactHeight : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <GameHeader
        className={styles.playHeader}
        title="Alfabeto"
        mobileLabel={`Vuelta ${round}`}
        right={
          <div className={styles.gameMeta}>
            <span>Vuelta {round}</span>
            {timer}
          </div>
        }
      />
      <div ref={scrollRef} className={styles.playScroll}>
        <div className={styles.playGrid}>
          <div className={styles.boardPanel}>
            <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {progressLabel}
            </p>
            <Card className={`${styles.boardCard} ${styles.playingBoard}`}>
              <AlphabetBoard letters={letters} currentIndex={currentIndex} />
            </Card>
            {navigation.isLastPending ? (
              <p className={styles.navigationHint} aria-live="polite">
                Última pendiente
              </p>
            ) : null}
          </div>
          <section className={styles.questionPanel} aria-labelledby="alphabet-question-title">
            <h1 id="alphabet-question-title">{question?.question ?? "Preparando…"}</h1>
            <AlphabetAnswerEditor
              value={draft.value}
              onChange={changeAnswer}
              mode={keyboardMode}
              onModeChange={setKeyboardMode}
              disabled={editingDisabled}
              visitKey={draft.visitKey}
              editorRef={editorRef}
              scrollRef={scrollRef}
              onSubmit={submit}
              placeholder={question?.answerPlaceholder}
              letterPlaceholder={question ? (navigation.current?.letter ?? null) : null}
              answerLength={question?.answerLength ?? null}
            />
            {error ? (
              <p className={styles.serverMessage} role="alert">
                {error}
              </p>
            ) : null}
            {feedbackVisible && feedback ? <AlphabetFeedback feedback={feedback} /> : null}
          </section>
        </div>
      </div>
      <AlphabetAnswerDock
        value={draft.value}
        onChange={changeAnswer}
        mode={keyboardMode}
        disabled={disabled}
        editorRef={editorRef}
        compact={keyboardLayout.compact}
        expanded={keyboardLayout.expanded}
        onToggle={() =>
          setKeyboardLayout((previous) => ({ ...previous, expanded: !previous.expanded }))
        }
        onPass={() => {
          if (!disabled && !actionPending.current) {
            actionPending.current = true;
            onPass();
          }
        }}
      />
    </form>
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
  const correctCount = entries.filter(
    (entry) => entry.result?.status === "correct" && entry.result.isCorrect,
  ).length;

  return (
    <div className={styles.stage}>
      <ReviewAnswerPanel
        entries={entries}
        countLabel={`${correctCount} de ${entries.length} letras acertadas`}
        title="Historial de respuestas"
        progress={{ value: correctCount, max: entries.length }}
        progressLabel="Letras acertadas"
        compactHeading
        backAtTop
        onBack={onBack}
        onReplay={onReplay}
      />
    </div>
  );
}
