"use client";

import { useCallback, useEffect, useRef } from "react";

export function useQueensDraftPersistence({
  persist,
  debounceMs = 300,
}: {
  persist: (queens: readonly number[]) => Promise<void>;
  debounceMs?: number;
}) {
  const latestDraftRef = useRef<readonly number[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const enqueue = useCallback(() => {
    const queens = latestDraftRef.current;
    if (!queens) return queueRef.current;
    latestDraftRef.current = null;
    const next = queueRef.current.then(() => persistRef.current(queens));
    queueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const schedule = useCallback(
    (queens: readonly number[]) => {
      latestDraftRef.current = [...queens];
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        void enqueue();
      }, debounceMs);
    },
    [debounceMs, enqueue],
  );

  const flush = useCallback(
    async (queens: readonly number[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      latestDraftRef.current = [...queens];
      await enqueue();
    },
    [enqueue],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    latestDraftRef.current = null;
    queueRef.current = Promise.resolve();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = undefined;
    },
    [],
  );

  return {
    schedule,
    flush,
    reset,
    latestDraft: () => latestDraftRef.current,
  };
}
