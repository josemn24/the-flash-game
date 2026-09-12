"use client";

import { useEffect, useRef, useState } from "react";

export type CountdownUrgency =
  { type: "seconds"; value: number } | { type: "ratio"; value: number };

export const DEFAULT_COUNTDOWN_URGENCY = {
  type: "seconds",
  value: 5,
} as const satisfies CountdownUrgency;

export function getDefaultCountdownUrgency(duration: number): CountdownUrgency {
  return duration > 0 && duration <= DEFAULT_COUNTDOWN_URGENCY.value
    ? { type: "ratio", value: 0.25 }
    : DEFAULT_COUNTDOWN_URGENCY;
}

export type CountdownMetrics = {
  remaining: number;
  ratio: number;
  display: number;
  urgent: boolean;
  finished: boolean;
};

export function getCountdownRemaining(deadlineAt: number, now: number) {
  return Math.max(0, (deadlineAt - now) / 1000);
}

export function createCountdownCompletionGuard() {
  let notified = false;

  return {
    shouldNotify(remaining: number) {
      if (remaining > 0 || notified) return false;
      notified = true;
      return true;
    },
  };
}

export function getCountdownMetrics(
  duration: number,
  remaining: number,
  urgency?: CountdownUrgency,
): CountdownMetrics {
  const safeDuration = Math.max(0, duration);
  const safeRemaining = Math.min(safeDuration, Math.max(0, remaining));
  const ratio = safeDuration > 0 ? safeRemaining / safeDuration : 0;
  const effectiveUrgency = urgency ?? getDefaultCountdownUrgency(safeDuration);
  const urgent =
    safeRemaining > 0 &&
    (effectiveUrgency.type === "seconds"
      ? safeRemaining <= Math.max(0, effectiveUrgency.value)
      : ratio <= Math.min(1, Math.max(0, effectiveUrgency.value)));

  return {
    remaining: safeRemaining,
    ratio,
    display: Math.ceil(safeRemaining),
    urgent,
    finished: safeRemaining <= 0,
  };
}

type CountdownState = {
  duration: number;
  remaining: number;
  resetKey?: string | number;
};

type UseCountdownOptions = {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
  resetKey?: string | number;
  deadlineAt?: number;
  urgency?: CountdownUrgency;
};

export function useCountdown({
  duration,
  active,
  onTimeUp,
  onTick,
  resetKey,
  deadlineAt,
  urgency,
}: UseCountdownOptions) {
  const [timerState, setTimerState] = useState<CountdownState>({
    duration,
    remaining: duration,
    resetKey,
  });
  const onTimeUpRef = useRef(onTimeUp);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTickRef.current = onTick;
  }, [onTimeUp, onTick]);

  useEffect(() => {
    if (!active) return;

    const endAt = deadlineAt ?? Date.now() + duration * 1000;
    let frameId = 0;
    const completion = createCountdownCompletionGuard();

    const update = () => {
      const next = getCountdownRemaining(endAt, Date.now());
      setTimerState({ duration, remaining: next, resetKey });
      onTickRef.current?.(next);

      if (next <= 0) {
        if (completion.shouldNotify(next)) onTimeUpRef.current();
        return;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [active, deadlineAt, duration, resetKey]);

  const current = timerState.duration === duration && timerState.resetKey === resetKey;
  const visibleRemaining = active && current ? timerState.remaining : duration;

  return getCountdownMetrics(duration, visibleRemaining, urgency);
}
