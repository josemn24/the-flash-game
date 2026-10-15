"use client";

import { useId, type CSSProperties, type ReactNode, type Ref } from "react";
import { MotionButton } from "@/components/ui";
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
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
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
  onValueChange,
  onSubmit,
  inputRef,
  autoFocus,
  animateSubmit,
  beforeInput,
  metaMessage,
  afterMeta,
  className,
}: MiniWordleViewProps) {
  const inputId = useId();
  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      {hint ? <p className={styles.hint}>Pista: {hint}</p> : null}
      <section
        className={styles.board}
        style={{ "--mini-wordle-columns": wordLength } as CSSProperties}
        aria-label="Intentos de Mini-Wordle"
      >
        {Array.from({ length: maxAttempts }, (_, rowIndex) => {
          const row = rows[rowIndex];
          return (
            <div
              key={rowIndex}
              className={styles.row}
              aria-label={`Intento ${rowIndex + 1}${row?.guess ? `: ${row.guess}` : ", vacío"}`}
            >
              {Array.from({ length: wordLength }, (_, columnIndex) => {
                const item = row?.feedback?.[columnIndex];
                return (
                  <span
                    key={columnIndex}
                    className={`${styles.tile} ${item ? styles[item.status] : styles.empty}`}
                    data-state={item?.status ?? "empty"}
                    aria-label={
                      item
                        ? `${item.letter}: ${labels[item.status]}`
                        : `Letra ${columnIndex + 1}, vacía`
                    }
                  >
                    <b>{item?.letter ?? row?.guess[columnIndex] ?? ""}</b>
                    {item ? <small aria-hidden="true">{marks[item.status]}</small> : null}
                  </span>
                );
              })}
            </div>
          );
        })}
      </section>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor={inputId}>Escribe tu intento</label>
        {beforeInput}
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            maxLength={wordLength}
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus={autoFocus}
            onChange={(event) => onValueChange(event.target.value)}
          />
          <MotionButton
            type="submit"
            disabled={disabled || !value.trim()}
            whileTap={animateSubmit ? { scale: 0.985 } : undefined}
          >
            Enviar
          </MotionButton>
        </div>
        <div className={styles.formMeta}>
          <span>
            Intento {Math.min(attemptsUsed + 1, maxAttempts)} de {maxAttempts}
          </span>
          {metaMessage}
        </div>
        {afterMeta}
      </form>
    </div>
  );
}
