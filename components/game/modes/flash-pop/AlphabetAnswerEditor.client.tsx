"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import { ArrowIcon, Button, GameKeyboard, RotateIcon } from "@/components/ui";
import {
  alphabetAnswerCharacters as characters,
  alphabetAnswerSlots,
  countAlphabetAnswerCharacters,
  deleteLastAlphabetCharacter,
} from "@/lib/gameplay/alphabetAnswerSlots";
import styles from "./FlashPopAlphabetGame.module.css";

export type AlphabetKeyboardMode = "game" | "device";
export type AlphabetEditorElement = HTMLDivElement | HTMLInputElement;

export { deleteLastAlphabetCharacter } from "@/lib/gameplay/alphabetAnswerSlots";

export function AlphabetAnswerEditor({
  value,
  onChange,
  mode,
  onModeChange,
  disabled,
  visitKey,
  editorRef,
  scrollRef,
  onSubmit,
  placeholder,
  letterPlaceholder,
  answerLength,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: AlphabetKeyboardMode;
  onModeChange: (mode: AlphabetKeyboardMode) => void;
  disabled: boolean;
  visitKey: string | null;
  editorRef: RefObject<AlphabetEditorElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSubmit: () => void;
  placeholder?: string | null;
  letterPlaceholder: string | null;
  answerLength: number | null;
}) {
  const labelId = useId();
  const hintId = useId();
  const lengthId = useId();
  const cursorRef = useRef<HTMLSpanElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const focusVisit = useRef<string | null>(null);
  const slots = alphabetAnswerSlots(value, answerLength);
  const written = countAlphabetAnswerCharacters(value);

  useEffect(() => {
    if (!disabled && mode === "game" && focusVisit.current !== visitKey) {
      editorRef.current?.focus({ preventScroll: true });
      focusVisit.current = visitKey;
    }
  }, [disabled, editorRef, mode, visitKey]);

  useEffect(() => {
    const area = scrollRef.current;
    const tiles = tilesRef.current;
    const keepResponseVisible = () => {
      const cursor = cursorRef.current;
      if (tiles && cursor) {
        tiles.scrollTop = Math.max(
          0,
          cursor.offsetTop + cursor.offsetHeight + 8 - tiles.clientHeight,
        );
        tiles.scrollLeft = Math.max(
          0,
          cursor.offsetLeft + cursor.offsetWidth + 8 - tiles.clientWidth,
        );
      }
      // Only move the game's scroll area; never scroll the page or its dock.
      const editor = editorRef.current;
      if (!area || !editor) return;
      const bounds = area.getBoundingClientRect();
      const response = editor.getBoundingClientRect();
      if (response.bottom > bounds.bottom) area.scrollTop += response.bottom - bounds.bottom + 8;
      else if (response.top < bounds.top) area.scrollTop -= bounds.top - response.top + 8;
    };
    keepResponseVisible();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(keepResponseVisible);
    if (area) observer.observe(area);
    if (tiles) observer.observe(tiles);
    return () => observer.disconnect();
  }, [value, visitKey, mode, editorRef, scrollRef, answerLength]);

  const switchKeyboard = () => {
    // Focus the native field in the same user gesture that chooses it.
    flushSync(() => onModeChange(mode === "game" ? "device" : "game"));
    const editor = editorRef.current;
    editor?.focus({ preventScroll: true });
    if (editor instanceof HTMLInputElement) editor.setSelectionRange(value.length, value.length);
  };

  return (
    <div className={styles.answerEditor}>
      <div className={styles.answerHeader}>
        <label id={labelId} htmlFor={mode === "device" ? `${labelId}-input` : undefined}>
          Tu respuesta
        </label>
        <button
          type="button"
          className={styles.keyboardSwitch}
          disabled={disabled}
          onClick={switchKeyboard}
        >
          {mode === "game" ? "Usar teclado" : "Usar teclado del juego"}
        </button>
      </div>
      <p id={lengthId} className={styles.srOnly}>
        {letterPlaceholder ? <span>Letra de referencia: {letterPlaceholder}. </span> : null}
        {answerLength !== null ? (
          <span>
            Respuesta principal: {answerLength} {answerLength === 1 ? "carácter" : "caracteres"}
          </span>
        ) : null}{" "}
        <span>
          {written} {written === 1 ? "escrito" : "escritos"}
        </span>
      </p>
      {mode === "device" ? (
        <input
          ref={editorRef as RefObject<HTMLInputElement | null>}
          id={`${labelId}-input`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-describedby={`${lengthId} ${hintId}`}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={placeholder ?? letterPlaceholder ?? "Escribe tu respuesta…"}
        />
      ) : (
        <div
          ref={editorRef as RefObject<HTMLDivElement | null>}
          className={styles.answerPanel}
          role="textbox"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-describedby={`${lengthId} ${hintId}`}
          aria-disabled={disabled}
          aria-multiline="false"
          onKeyDown={(event) => {
            if (
              disabled ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.nativeEvent.isComposing
            )
              return;
            if (event.key === "Enter") {
              event.preventDefault();
              if (!event.repeat) onSubmit();
            } else if (event.key === "Backspace") {
              event.preventDefault();
              onChange(deleteLastAlphabetCharacter(value));
            } else if (characters(event.key).length === 1) {
              event.preventDefault();
              onChange(value + event.key);
            }
          }}
        >
          <span className={styles.srOnly}>{value || "Respuesta vacía"}</span>
          <div ref={tilesRef} className={styles.answerTiles} aria-hidden="true">
            {slots.map((slot, index) => {
              const isLetterPlaceholder =
                slot.kind === "empty" && slot.active && written === 0 && !!letterPlaceholder;
              return (
                <span
                  key={index}
                  data-answer-slot={slot.kind}
                  data-answer-placeholder={isLetterPlaceholder ? letterPlaceholder : undefined}
                  ref={
                    slot.kind === "caret" || (slot.kind === "empty" && slot.active)
                      ? cursorRef
                      : undefined
                  }
                  className={
                    slot.kind === "filled"
                      ? styles.answerTile
                      : slot.kind === "space"
                        ? styles.answerSpace
                        : slot.kind === "caret"
                          ? `${styles.writingCaret} ${styles.activeSlot}`
                          : `${styles.emptyAnswerSlot} ${slot.active ? styles.activeSlot : ""} ${isLetterPlaceholder ? styles.letterPlaceholder : ""}`
                  }
                >
                  {slot.kind === "filled"
                    ? slot.character
                    : isLetterPlaceholder
                      ? letterPlaceholder
                      : null}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <p id={hintId} className={styles.answerHint}>
        No importan las mayúsculas ni las tildes
      </p>
    </div>
  );
}

export function AlphabetAnswerDock({
  value,
  onChange,
  mode,
  disabled,
  editorRef,
  compact,
  expanded,
  onToggle,
  onPass,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: AlphabetKeyboardMode;
  disabled: boolean;
  editorRef: RefObject<AlphabetEditorElement | null>;
  compact: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPass: () => void;
}) {
  const keyboardId = useId();
  return (
    <footer className={styles.answerDock}>
      <div className={styles.answerActions}>
        <Button
          variant="secondary"
          type="button"
          className={styles.passButton}
          disabled={disabled}
          onClick={onPass}
          trailingIcon={<RotateIcon />}
        >
          Pasar
        </Button>
        <Button type="submit" disabled={disabled || !value.trim()} trailingIcon={<ArrowIcon />}>
          Responder
        </Button>
      </div>
      {mode === "game" ? (
        <>
          {compact ? (
            <button
              type="button"
              className={styles.keyboardToggle}
              aria-expanded={expanded}
              aria-controls={keyboardId}
              disabled={disabled}
              onClick={onToggle}
            >
              {expanded ? "Ocultar teclado" : "Mostrar teclado"}
            </button>
          ) : null}
          {!compact || expanded ? (
            <div className={styles.keyboardArea}>
              <GameKeyboard
                id={keyboardId}
                disabled={disabled}
                includeSpace
                compact={compact}
                onPreserveFocus={() => editorRef.current?.focus({ preventScroll: true })}
                onKeyPress={(key) =>
                  onChange(key === "Backspace" ? deleteLastAlphabetCharacter(value) : value + key)
                }
              />
            </div>
          ) : null}
        </>
      ) : null}
    </footer>
  );
}
