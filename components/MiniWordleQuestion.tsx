"use client";

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "@/components/MiniWordleQuestion.module.css";
import { MotionButton } from "@/components/ui/MotionButton.client";
import {
  getMiniWordleFeedback,
  isValidMiniWordleWord,
  MINI_WORDLE_MAX_ATTEMPTS,
  MINI_WORDLE_WORD_LENGTH,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import type { MiniWordleAnswer } from "@/types/game";

type Props = {
  correctAnswer: string;
  additionalGuesses?: string[];
  hint?: string;
  locked: boolean;
  onProgress: (answer: MiniWordleAnswer) => void;
  onSubmit: (answer: MiniWordleAnswer) => void;
  onTimedResponseStart: () => void;
};

const STATUS_LABELS = {
  correct: "posición correcta",
  present: "está en otra posición",
  absent: "no está en la palabra",
} as const;

const STATUS_MARKS = {
  correct: "✓",
  present: "↔",
  absent: "×",
} as const;

export function MiniWordleQuestion({
  correctAnswer,
  additionalGuesses = [],
  hint,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: Props) {
  const [guesses, setGuesses] = useState<string[]>([]);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timedResponseStartedRef = useRef(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [dictionaryError, setDictionaryError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadMiniWordleDictionary()
      .then((words) => {
        if (active) setDictionary(words);
      })
      .catch(() => {
        if (active) setDictionaryError(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!dictionary || timedResponseStartedRef.current) return;
    timedResponseStartedRef.current = true;
    onTimedResponseStart();
    inputRef.current?.focus();
  }, [dictionary, onTimedResponseStart]);

  const normalizedValidGuesses = useMemo(
    () =>
      new Set([
        ...(dictionary ?? []),
        ...additionalGuesses.map(normalizeMiniWordleWord),
        normalizeMiniWordleWord(correctAnswer),
      ]),
    [additionalGuesses, correctAnswer, dictionary],
  );
  const dictionaryReady = dictionary !== null;

  const submitGuess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dictionaryReady || locked || guesses.length >= MINI_WORDLE_MAX_ATTEMPTS) return;

    const guess = normalizeMiniWordleWord(value);
    if (!isValidMiniWordleWord(guess)) {
      setError(`Escribe una palabra de ${MINI_WORDLE_WORD_LENGTH} letras.`);
      return;
    }
    if (!normalizedValidGuesses.has(guess)) {
      setError("Esa palabra no está en la lista de intentos válidos.");
      return;
    }

    const nextGuesses = [...guesses, guess];
    const answer = { guesses: nextGuesses };
    const solved = guess === normalizeMiniWordleWord(correctAnswer);
    setGuesses(nextGuesses);
    setValue("");
    setError("");
    onProgress(answer);
    if (solved || nextGuesses.length === MINI_WORDLE_MAX_ATTEMPTS) onSubmit(answer);
  };

  return (
    <div className={styles.root}>
      {hint && <p className={styles.hint}>Pista: {hint}</p>}

      <section className={styles.board} aria-label="Intentos de Mini-Wordle">
        {Array.from({ length: MINI_WORDLE_MAX_ATTEMPTS }, (_, rowIndex) => {
          const guess = guesses[rowIndex];
          const feedback = guess ? getMiniWordleFeedback(guess, correctAnswer) : null;
          return (
            <div
              key={rowIndex}
              className={styles.row}
              aria-label={`Intento ${rowIndex + 1}${guess ? `: ${guess}` : ", vacío"}`}
            >
              {Array.from({ length: MINI_WORDLE_WORD_LENGTH }, (_, columnIndex) => {
                const item = feedback?.[columnIndex];
                return (
                  <span
                    key={columnIndex}
                    className={`${styles.tile} ${item ? styles[item.status] : styles.empty}`}
                    aria-label={
                      item
                        ? `${item.letter}: ${STATUS_LABELS[item.status]}`
                        : `Letra ${columnIndex + 1}, vacía`
                    }
                  >
                    <b>{item?.letter ?? ""}</b>
                    {item && <small aria-hidden="true">{STATUS_MARKS[item.status]}</small>}
                  </span>
                );
              })}
            </div>
          );
        })}
      </section>

      <form className={styles.form} onSubmit={submitGuess}>
        <label htmlFor={inputId}>Escribe tu intento</label>
        {!dictionaryReady && !dictionaryError && (
          <p className={styles.dictionaryStatus} role="status">
            Cargando diccionario…
          </p>
        )}
        {dictionaryError && (
          <div className={styles.dictionaryError} role="alert">
            <span>No se pudo cargar el diccionario.</span>
            <MotionButton
              type="button"
              variant="secondary"
              onClick={() => {
                setDictionaryError(false);
                setLoadAttempt((current) => current + 1);
              }}
            >
              Reintentar
            </MotionButton>
          </div>
        )}
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            maxLength={MINI_WORDLE_WORD_LENGTH}
            disabled={!dictionaryReady || locked || guesses.length >= MINI_WORDLE_MAX_ATTEMPTS}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus={dictionaryReady}
            onChange={(event) => {
              setValue(event.target.value.toLocaleUpperCase("es-ES"));
              if (error) setError("");
            }}
          />
          <MotionButton
            type="submit"
            disabled={
              !dictionaryReady ||
              locked ||
              !value.trim() ||
              guesses.length >= MINI_WORDLE_MAX_ATTEMPTS
            }
            whileTap={{ scale: 0.985 }}
          >
            Enviar
          </MotionButton>
        </div>
        <div className={styles.formMeta}>
          <span>
            Intento {Math.min(guesses.length + 1, MINI_WORDLE_MAX_ATTEMPTS)} de{" "}
            {MINI_WORDLE_MAX_ATTEMPTS}
          </span>
          <span className={styles.error} role="status" aria-live="polite">
            {error}
          </span>
        </div>
      </form>
    </div>
  );
}
