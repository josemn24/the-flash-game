"use client";

import { useCallback, useEffect, useRef } from "react";

export type CompetitiveTimerName =
  "transition" | "submission" | "answer-verification" | "reveal" | "queens" | "word-search";

export function useCompetitivePhaseTimers() {
  const timersRef = useRef<Partial<Record<CompetitiveTimerName, ReturnType<typeof setTimeout>>>>(
    {},
  );

  const clear = useCallback((name: CompetitiveTimerName) => {
    const timer = timersRef.current[name];
    if (timer) clearTimeout(timer);
    delete timersRef.current[name];
  }, []);

  const schedule = useCallback(
    (name: CompetitiveTimerName, callback: () => void, delayMs: number) => {
      clear(name);
      timersRef.current[name] = setTimeout(() => {
        delete timersRef.current[name];
        callback();
      }, delayMs);
    },
    [clear],
  );

  useEffect(
    () => () => {
      for (const timer of Object.values(timersRef.current)) {
        if (timer) clearTimeout(timer);
      }
      timersRef.current = {};
    },
    [],
  );

  return { clear, schedule };
}
