"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMiniWordleFeedback,
  getMiniWordleMaxAttempts,
  getMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
  normalizeMiniWordleDraft,
} from "@/lib/miniWordle";
import { loadMiniWordleDictionary } from "@/lib/miniWordleDictionary";
import type { MiniWordleAnswer } from "@/types/gameplay/practice";

export type PracticeMiniWordleOptions = {
  correctAnswer: string;
  additionalGuesses?: string[];
  hint?: string;
  wordLength?: 4 | 5;
  maxAttempts?: number;
  initialAnswer?: MiniWordleAnswer;
  locked: boolean;
  onProgress: (answer: MiniWordleAnswer) => void;
  onSubmit: (answer: MiniWordleAnswer) => void;
  onTimedResponseStart: () => void;
};

const noAdditionalGuesses: string[] = [];

export function usePracticeMiniWordle({
  correctAnswer,
  additionalGuesses = noAdditionalGuesses,
  wordLength: configuredWordLength,
  maxAttempts: configuredMaxAttempts,
  initialAnswer,
  locked,
  onProgress,
  onSubmit,
  onTimedResponseStart,
}: PracticeMiniWordleOptions) {
  const wordLength = getMiniWordleWordLength({ wordLength: configuredWordLength });
  const maxAttempts = getMiniWordleMaxAttempts({ maxAttempts: configuredMaxAttempts });
  const [guesses, setGuesses] = useState(() =>
    (initialAnswer?.guesses ?? []).slice(0, maxAttempts).map(normalizeMiniWordleWord),
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [dictionaryError, setDictionaryError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const timedResponseStarted = useRef(false);
  const acceptedGuesses = useRef<readonly string[] | null>(null);

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
    if (!dictionary || timedResponseStarted.current) return;
    timedResponseStarted.current = true;
    onTimedResponseStart();
  }, [dictionary, onTimedResponseStart]);

  const validGuesses = useMemo(
    () =>
      new Set([
        ...(dictionary ?? []),
        ...additionalGuesses.map(normalizeMiniWordleWord),
        normalizeMiniWordleWord(correctAnswer),
      ]),
    [additionalGuesses, correctAnswer, dictionary],
  );
  const rows = useMemo(
    () =>
      guesses.map((guess) => ({
        guess,
        feedback: getMiniWordleFeedback(guess, correctAnswer),
      })),
    [guesses, correctAnswer],
  );
  const solved = guesses.includes(normalizeMiniWordleWord(correctAnswer));
  const canSubmit = dictionary !== null && !locked && !solved && guesses.length < maxAttempts;

  function submit() {
    if (!canSubmit || acceptedGuesses.current === guesses) return;
    const guess = normalizeMiniWordleWord(value);
    if (!isValidMiniWordleWord(guess, wordLength)) {
      setError(`Escribe una palabra de ${wordLength} letras.`);
      return;
    }
    if (!validGuesses.has(guess)) {
      setError("Esa palabra no está en la lista de intentos válidos.");
      return;
    }
    const nextGuesses = [...guesses, guess];
    acceptedGuesses.current = guesses;
    const answer = { guesses: nextGuesses };
    setGuesses(nextGuesses);
    setValue("");
    setError("");
    onProgress(answer);
    if (guess === normalizeMiniWordleWord(correctAnswer) || nextGuesses.length === maxAttempts) {
      onSubmit(answer);
    }
  }

  return {
    wordLength,
    maxAttempts,
    rows,
    value,
    error,
    canSubmit,
    attemptsUsed: guesses.length,
    dictionaryReady: dictionary !== null,
    dictionaryError,
    changeValue(next: string) {
      if (!canSubmit) return;
      setValue(normalizeMiniWordleDraft(next, wordLength));
      if (error) setError("");
    },
    retryDictionary() {
      setDictionaryError(false);
      setLoadAttempt((current) => current + 1);
    },
    submit,
  };
}
