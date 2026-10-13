"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Card, CheckIcon, CrossIcon, GameHeader, IconButton, PendingIcon } from "@/components/ui";
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
  label,
  current = false,
  className = "",
}: {
  item: AlphabetPresentationLetter | null;
  label?: string;
  current?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${styles.letterCell} ${item ? styles[`status_${item.status}`] : styles.emptyCell} ${className}`}
      role="listitem"
      aria-current={current ? "step" : undefined}
      aria-label={`${label ? `${label}: ` : ""}${item ? `${item.letter}: ${STATUS_LABELS[item.status]}` : "no disponible"}`}
    >
      <span>{item?.letter ?? "—"}</span>
      {item?.status === "correct" ? (
        <CheckIcon aria-hidden="true" className={styles.markIcon} />
      ) : null}
      {item?.status === "incorrect" ? (
        <CrossIcon aria-hidden="true" className={styles.markIcon} />
      ) : null}
      {item?.status === "passed" ? (
        <span aria-hidden="true" className={styles.passMark}>
          ↻
        </span>
      ) : null}
      {item?.status === "unanswered" ? (
        <span aria-hidden="true" className={styles.emptyMark}>
          —
        </span>
      ) : null}
    </div>
  );
}

function AlphabetBoard({ letters }: { letters: readonly AlphabetPresentationLetter[] }) {
  return (
    <div className={styles.board} role="list" aria-label="Estado de las letras">
      {letters.map((item) => (
        <LetterCell key={item.letter} item={item} />
      ))}
    </div>
  );
}

export function AlphabetPlayingPresentation({
  round,
  currentIndex,
  answerVisitKey,
  timer,
  dialogTimer,
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
  dialogTimer: ReactNode;
  letters: readonly AlphabetPresentationLetter[];
  question: AlphabetPresentationQuestion | null;
  locked: boolean;
  busy?: boolean;
  error?: string;
  feedback?: AlphabetPresentationFeedback;
  onSubmit: (answer: string) => void;
  onPass: () => void;
}) {
  const [visit, setVisit] = useState({
    currentIndex,
    previousIndex: null as number | null,
    round,
    key: answerVisitKey,
  });
  // A prepared question confirms a visit, including a pass back to the only pending letter.
  if (
    currentIndex !== null &&
    question &&
    (currentIndex !== visit.currentIndex ||
      round !== visit.round ||
      (answerVisitKey !== null && answerVisitKey !== visit.key))
  ) {
    setVisit({ currentIndex, previousIndex: visit.currentIndex, round, key: answerVisitKey });
  }
  const navigation = getAlphabetNavigation(letters, currentIndex, visit.previousIndex);
  const progressLabel = formatAlphabetProgress(
    navigation.correctAnswers,
    navigation.incorrectAnswers,
    navigation.pendingLetters,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<AlphabetEditorElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLFormElement>(null);
  const initialAnswer = question ? (navigation.current?.letter ?? "") : "";
  const [draft, setDraft] = useState({
    visitKey: initialAnswer ? answerVisitKey : null,
    value: initialAnswer,
  });
  // Seed once per prepared visit; deleting the initial remains an ordinary edit.
  if (initialAnswer && answerVisitKey !== null && answerVisitKey !== draft.visitKey) {
    setDraft({ visitKey: answerVisitKey, value: initialAnswer });
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
      const compact = (viewport?.height ?? window.innerHeight) <= 480;
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
  const wasEditing = useRef(false);
  const scrollPosition = useRef({ x: 0, y: 0 });
  const dialogId = useId();
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen) {
      if (!dialog.open) dialog.showModal();
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (dialog.open) {
      dialog.close();
      const target =
        wasEditing.current && editorRef.current ? editorRef.current : openButtonRef.current;
      target?.focus({ preventScroll: true });
      window.scrollTo(scrollPosition.current.x, scrollPosition.current.y);
    }
  }, [dialogOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const onChange = () => {
      if (!media.matches) setDialogOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!dialogOpen || !dialog || !viewport) return;
    const syncViewport = () => {
      dialog.style.setProperty("--alphabet-dialog-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--alphabet-dialog-viewport-top", `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      dialog.style.removeProperty("--alphabet-dialog-viewport-height");
      dialog.style.removeProperty("--alphabet-dialog-viewport-top");
    };
  }, [dialogOpen]);

  const feedbackId = feedback?.id ?? null;
  const [hiddenFeedbackId, setHiddenFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackId) return;

    const timeout = window.setTimeout(() => setHiddenFeedbackId(feedbackId), 1_350);
    return () => window.clearTimeout(timeout);
  }, [feedbackId]);

  const feedbackVisible = feedback !== undefined && hiddenFeedbackId !== feedbackId;

  const editingDisabled = locked || busy || feedbackVisible || !question;
  const disabled = editingDisabled || dialogOpen;
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
      <div className={styles.progressRow}>
        <p className={styles.progressCounters} role="status" aria-live="polite" aria-atomic="true">
          <span className={styles.srOnly}>{progressLabel}</span>
          <span className={styles.progressCounter} aria-hidden="true" title="Aciertos">
            <CheckIcon className={styles.progressCorrect} />
            <span>{navigation.correctAnswers}</span>
          </span>
          <span className={styles.progressCounter} aria-hidden="true" title="Fallos">
            <CrossIcon className={styles.progressIncorrect} />
            <span>{navigation.incorrectAnswers}</span>
          </span>
          <span className={styles.progressCounter} aria-hidden="true" title="Pendientes">
            <PendingIcon className={styles.progressPending} />
            <span>{navigation.pendingLetters}</span>
          </span>
        </p>
        <button
          ref={openButtonRef}
          type="button"
          className={styles.boardButton}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          disabled={locked || busy || feedbackVisible || !question}
          onPointerDown={() => {
            wasEditing.current = document.activeElement === editorRef.current;
          }}
          onClick={(event) => {
            if (event.detail === 0) wasEditing.current = false;
            scrollPosition.current = { x: window.scrollX, y: window.scrollY };
            setDialogOpen(true);
          }}
        >
          Ver todas
        </button>
      </div>
      <div ref={scrollRef} className={styles.playScroll}>
        <div className={styles.playGrid}>
          <div className={styles.compactNavigation}>
            <div className={styles.navigation} role="list" aria-label="Recorrido de letras">
              <LetterCell
                item={navigation.previous}
                label="Anterior"
                className={styles.navigationCell}
              />
              <LetterCell
                item={navigation.current}
                label="Actual"
                current
                className={`${styles.navigationCell} ${styles.currentCell}`}
              />
              <LetterCell
                item={navigation.next}
                label="Siguiente"
                className={styles.navigationCell}
              />
            </div>
            <p className={styles.navigationHint} aria-live="polite">
              {navigation.isLastPending ? "Última pendiente" : ""}
            </p>
          </div>
          <Card className={`${styles.boardCard} ${styles.desktopBoard}`}>
            <AlphabetBoard letters={letters} />
          </Card>
          <section className={styles.questionPanel} aria-labelledby="alphabet-question-title">
            <h1 id="alphabet-question-title">{question?.question ?? "Preparando…"}</h1>
            <AlphabetAnswerEditor
              value={draft.value}
              onChange={changeAnswer}
              mode={keyboardMode}
              onModeChange={setKeyboardMode}
              disabled={editingDisabled}
              focusBlocked={dialogOpen}
              visitKey={draft.visitKey}
              editorRef={editorRef}
              scrollRef={scrollRef}
              onSubmit={submit}
              placeholder={question?.answerPlaceholder}
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
      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.boardDialog}
        aria-labelledby={titleId}
        onClose={() => setDialogOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setDialogOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDialogOpen(false);
        }}
      >
        <div className={styles.dialogSurface}>
          <header className={styles.dialogHeader}>
            <h2 id={titleId}>Estado de las letras</h2>
            <IconButton
              ref={closeButtonRef}
              label="Cerrar tablero"
              onClick={() => setDialogOpen(false)}
            >
              <CrossIcon />
            </IconButton>
          </header>
          <div className={styles.dialogMeta}>
            <span>Vuelta {round}</span>
            {dialogTimer}
          </div>
          <p className={styles.progressSummary}>{progressLabel}</p>
          <AlphabetBoard letters={letters} />
        </div>
      </dialog>
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
