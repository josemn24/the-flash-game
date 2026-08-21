"use client";

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "@/components/MiniWordleQuestion.module.css";
import { MotionButton } from "@/components/ui/MotionButton.client";
import {
  getMiniWordleFeedback,
  getMiniWordleMaxAttempts,
  getMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import type { MiniWordleAnswer } from "@/types/game";

type Props = {
  correctAnswer: string;
  additionalGuesses?: string[];
  hint?: string;
  wordLength?: 4 | 5;
  maxAttempts?: number;
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
  wordLength: configuredWordLength,
  maxAttempts: configuredMaxAttempts,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: Props) {
  const wordLength = getMiniWordleWordLength({ wordLength: configuredWordLength });
  const maxAttempts = getMiniWordleMaxAttempts({ maxAttempts: configuredMaxAttempts });
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
    loadMiniWordleDictionary(wordLength)
      .then((words) => {
        if (active) setDictionary(words);
      })
      .catch(() => {
        if (active) setDictionaryError(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, wordLength]);

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
    if (!dictionaryReady || locked || guesses.length >= maxAttempts) return;

    const guess = normalizeMiniWordleWord(value);
    if (!isValidMiniWordleWord(guess, wordLength)) {
      setError(`Escribe una palabra de ${wordLength} letras.`);
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
    if (solved || nextGuesses.length === maxAttempts) onSubmit(answer);
  };

  return (
    <div className={styles.root}>
      {hint && <p className={styles.hint}>Pista: {hint}</p>}

      <section className={styles.board} aria-label="Intentos de Mini-Wordle">
        {Array.from({ length: maxAttempts }, (_, rowIndex) => {
          const guess = guesses[rowIndex];
          const feedback = guess ? getMiniWordleFeedback(guess, correctAnswer) : null;
          return (
            <div
              key={rowIndex}
              className={styles.row}
              aria-label={`Intento ${rowIndex + 1}${guess ? `: ${guess}` : ", vacío"}`}
            >
              {Array.from({ length: wordLength }, (_, columnIndex) => {
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
            maxLength={wordLength}
            disabled={!dictionaryReady || locked || guesses.length >= maxAttempts}
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
            disabled={!dictionaryReady || locked || !value.trim() || guesses.length >= maxAttempts}
            whileTap={{ scale: 0.985 }}
          >
            Enviar
          </MotionButton>
        </div>
        <div className={styles.formMeta}>
          <span>
            Intento {Math.min(guesses.length + 1, maxAttempts)} de {maxAttempts}
          </span>
          <span className={styles.error} role="status" aria-live="polite">
            {error}
          </span>
        </div>
      </form>
    </div>
  );
}
