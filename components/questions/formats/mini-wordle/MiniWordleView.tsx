"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { GameKeyboard, MotionButton } from "@/components/ui";
import { KeyboardGameDock } from "@/components/ui/KeyboardGameLayout";
import { normalizeMiniWordleDraft } from "@/lib/miniWordle";
import { useMiniWordleKeyboardMode } from "@/features/question-formats/formats/mini-wordle/useMiniWordleKeyboardMode";
import type { MiniWordleLetterFeedback, MiniWordleWordLength } from "@/types/domain/mini-wordle";
import styles from "./MiniWordleQuestion.module.css";

export type MiniWordleViewProps = {
  rows: readonly { guess: string; feedback?: readonly MiniWordleLetterFeedback[] }[];
  wordLength: MiniWordleWordLength;
  maxAttempts: number;
  attemptsUsed: number;
  hint?: string | null;
  value: string;
  disabled: boolean;
  busy?: boolean;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  animateSubmit?: boolean;
  beforeInput?: ReactNode;
  metaMessage?: ReactNode;
  afterMeta?: ReactNode;
  className?: string;
};

const labels = {
  correct: "posición correcta",
  present: "está en otra posición",
  absent: "no está en la palabra",
};
const marks = { correct: "✓", present: "↔", absent: "×" };

export function MiniWordleView({
  rows,
  wordLength,
  maxAttempts,
  attemptsUsed,
  hint,
  value,
  disabled,
  busy = false,
  onValueChange,
  onSubmit,
  animateSubmit,
  beforeInput,
  metaMessage,
  afterMeta,
  className,
}: MiniWordleViewProps) {
  const hintId = useId();
  const counterId = useId();
  const formId = useId();
  const editorRef = useRef<HTMLDivElement | HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const initiallyFocused = useRef(false);
  const composing = useRef(false);
  const [compositionValue, setCompositionValue] = useState<string | null>(null);
  const [mode, setMode, canChooseKeyboard] = useMiniWordleKeyboardMode();
  const activeIndex = Math.min(attemptsUsed, maxAttempts - 1);
  const lastFeedback = rows.at(-1)?.feedback;
  const solved =
    lastFeedback?.length === wordLength &&
    lastFeedback.every((letter) => letter.status === "correct");
  const hasActiveRow = attemptsUsed < maxAttempts && !solved;
  const draft =
    compositionValue === null ? value : normalizeMiniWordleDraft(compositionValue, wordLength);
  const canSend = !disabled && value.length === wordLength && compositionValue === null;

  const focusEditor = () => {
    editorRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (disabled || initiallyFocused.current || mode !== "game") return;
    initiallyFocused.current = true;
    // Do not take focus from navigation or another part of the page.
    if (
      document.activeElement === document.body ||
      document.activeElement === rootRef.current?.closest("dialog") ||
      rootRef.current?.contains(document.activeElement)
    ) {
      editorRef.current?.focus({ preventScroll: true });
    }
  }, [disabled, mode]);

  useEffect(() => {
    const area = rootRef.current?.closest<HTMLElement>("[data-keyboard-scroll]");
    if (!area) return;
    const keepActiveRowVisible = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const bounds = area.getBoundingClientRect();
      const row = editor.getBoundingClientRect();
      const margin = Math.min(8, Math.max(0, (bounds.height - row.height) / 2));
      if (row.bottom > bounds.bottom - margin)
        area.scrollTop += row.bottom - bounds.bottom + margin;
      else if (row.top < bounds.top + margin) area.scrollTop -= bounds.top - row.top + margin;
    };
    keepActiveRowVisible();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(keepActiveRowVisible);
    observer.observe(area);
    return () => observer.disconnect();
  }, [attemptsUsed, value, disabled, mode]);

  const change = (next: string) => {
    if (!disabled) onValueChange(normalizeMiniWordleDraft(next, wordLength));
  };
  const pressKey = (key: string) => {
    if (!disabled) change(key === "Backspace" ? value.slice(0, -1) : value + key);
  };
  const submitGuess = () => {
    if (!canSend || composing.current) return;
    // Keyboard users can reach Send with Tab; keep subsequent letters in the editor.
    if (document.activeElement === sendRef.current) focusEditor();
    onSubmit();
  };
  const switchKeyboard = () => {
    composing.current = false;
    setCompositionValue(null);
    flushSync(() => setMode(mode === "game" ? "device" : "game"));
    // Mobile browsers require native focus within this user gesture.
    focusEditor();
    if (editorRef.current instanceof HTMLInputElement) {
      editorRef.current.setSelectionRange(value.length, value.length);
    }
  };
  const lastRow = rows.at(-1);
  const resultAnnouncement = lastRow?.feedback
    ? `Intento ${attemptsUsed}: ${lastRow.guess}. ${lastRow.feedback.map((letter) => `${letter.letter}: ${labels[letter.status]}`).join(". ")}.`
    : "";

  return (
    <form
      id={formId}
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        submitGuess();
      }}
    >
      {hint ? <p className={styles.hint}>Pista: {hint}</p> : null}
      {beforeInput}
      <section
        className={styles.board}
        style={
          {
            "--mini-wordle-columns": wordLength,
            "--mini-wordle-active-row": activeIndex,
          } as CSSProperties
        }
        aria-label="Intentos de Mini-Wordle"
        aria-busy={busy}
      >
        {Array.from({ length: maxAttempts }, (_, rowIndex) => {
          const row = rows[rowIndex];
          const active = hasActiveRow && rowIndex === attemptsUsed;
          return (
            <div
              key={rowIndex}
              className={`${styles.row} ${active ? styles.activeRow : ""}`}
              aria-label={
                active
                  ? `Intento ${rowIndex + 1}, en curso`
                  : `Intento ${rowIndex + 1}${row?.guess ? `: ${row.guess}` : ", vacío"}`
              }
            >
              {Array.from({ length: wordLength }, (_, columnIndex) => {
                const item = row?.feedback?.[columnIndex];
                const letter =
                  item?.letter ??
                  row?.guess[columnIndex] ??
                  (active ? draft[columnIndex] : "") ??
                  "";
                return (
                  <span
                    key={columnIndex}
                    className={`${styles.tile} ${item ? styles[item.status] : styles.empty} ${active && columnIndex === Math.min(draft.length, wordLength - 1) ? styles.cursor : ""}`}
                    data-state={item?.status ?? (letter ? "draft" : "empty")}
                    aria-hidden={active || undefined}
                    aria-label={
                      item
                        ? `${item.letter}: ${labels[item.status]}`
                        : `Letra ${columnIndex + 1}, vacía`
                    }
                  >
                    <b>{letter}</b>
                    {item ? <small aria-hidden="true">{marks[item.status]}</small> : null}
                  </span>
                );
              })}
            </div>
          );
        })}
        {mode === "game" ? (
          <div
            ref={editorRef as RefObject<HTMLDivElement | null>}
            className={styles.editor}
            role="textbox"
            tabIndex={0}
            aria-label="Escribe tu intento"
            aria-describedby={`${counterId} ${hintId}`}
            aria-disabled={disabled}
            aria-multiline="false"
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing)
                return;
              const letter = normalizeMiniWordleDraft(event.key, wordLength);
              if (event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) submitGuess();
              } else if (event.key === "Backspace") {
                event.preventDefault();
                pressKey("Backspace");
              } else if (event.key === " ") {
                event.preventDefault();
              } else if (Array.from(event.key).length === 1 && letter) {
                event.preventDefault();
                pressKey(letter);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              if (!disabled) change(value + event.clipboardData.getData("text"));
            }}
          >
            <span className={styles.srOnly}>{value || "Intento vacío"}</span>
          </div>
        ) : (
          <input
            ref={editorRef as RefObject<HTMLInputElement | null>}
            className={`${styles.editor} ${styles.nativeEditor}`}
            type="text"
            aria-label="Escribe tu intento"
            aria-describedby={`${counterId} ${hintId}`}
            aria-disabled={disabled}
            value={compositionValue ?? value}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoCorrect="off"
            enterKeyHint="send"
            onBeforeInput={(event) => {
              if (disabled) event.preventDefault();
            }}
            onPaste={(event) => {
              if (disabled) event.preventDefault();
            }}
            onClick={(event) => event.currentTarget.setSelectionRange(value.length, value.length)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey)
                return;
              if (event.key === "Enter") {
                event.preventDefault();
                if (!event.repeat) submitGuess();
              } else if (disabled && !event.ctrlKey && !event.metaKey && event.key !== "Tab") {
                event.preventDefault();
              }
            }}
            onCompositionStart={() => {
              composing.current = true;
              setCompositionValue(value);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              setCompositionValue(null);
              change(event.currentTarget.value);
            }}
            onChange={(event) => {
              if (disabled) return;
              if (composing.current) setCompositionValue(event.target.value);
              else change(event.target.value);
            }}
          />
        )}
      </section>
      <p id={hintId} className={styles.srOnly}>
        Escribe {wordLength} letras. Usa borrar para corregir y Enter para enviar.
      </p>
      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {resultAnnouncement}
      </span>
      <KeyboardGameDock>
        <div className={styles.dockContent}>
          <div className={styles.controls}>
            <div className={styles.formMeta}>
              <span id={counterId} className={styles.srOnly}>
                Intento {Math.min(attemptsUsed + 1, maxAttempts)} de {maxAttempts}
              </span>
              {metaMessage}
            </div>
            {afterMeta}
            {canChooseKeyboard ? (
              <button
                type="button"
                tabIndex={0}
                className={styles.keyboardSwitch}
                disabled={disabled}
                onClick={switchKeyboard}
              >
                {mode === "game" ? "Usar teclado del dispositivo" : "Usar teclado del juego"}
              </button>
            ) : null}
          </div>
          <div className={styles.answerDock}>
            <MotionButton
              ref={sendRef}
              form={formId}
              type="submit"
              disabled={!canSend}
              whileTap={animateSubmit ? { scale: 0.985 } : undefined}
              onPointerDown={(event) => {
                // Motion synthesizes pointer events without a pointerType for Enter.
                // Moving focus during that synthetic keydown cancels native activation.
                if (!event.pointerType) return;
                event.preventDefault();
                focusEditor();
              }}
            >
              Enviar
            </MotionButton>
            {mode === "game" ? (
              <GameKeyboard
                disabled={disabled}
                onKeyPress={pressKey}
                onPreserveFocus={focusEditor}
              />
            ) : null}
          </div>
        </div>
      </KeyboardGameDock>
    </form>
  );
}
