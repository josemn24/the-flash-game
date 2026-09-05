"use client";

import type { CSSProperties } from "react";
import { useCountdown } from "@/features/game/useCountdown";
import styles from "./Timer.module.css";

export type TimerDisplayProps = {
  duration: number;
  remaining: number;
  state?: "auto" | "normal" | "urgent" | "finished";
  size?: "default" | "compact";
  className?: string;
};

export function TimerDisplay({
  duration,
  remaining,
  state = "auto",
  size = "default",
  className,
}: TimerDisplayProps) {
  const safeDuration = Math.max(0, duration);
  const safeRemaining = Math.min(safeDuration, Math.max(0, remaining));
  const ratio = safeDuration > 0 ? safeRemaining / safeDuration : 0;
  const resolvedState =
    state === "auto"
      ? safeRemaining <= 0
        ? "finished"
        : ratio <= 0.25
          ? "urgent"
          : "normal"
      : state;
  const display = Math.ceil(safeRemaining);
  const label = resolvedState === "finished" ? "Tiempo agotado" : `${display} segundos restantes`;

  return (
    <span
      className={`${styles.timer} ${styles[resolvedState]} ${size === "compact" ? styles.compact : ""} ${className ?? ""}`}
      style={{ "--timer-ratio": ratio } as CSSProperties}
      role="timer"
      aria-label={label}
      data-state={resolvedState}
    >
      <span className={styles.value}>{display}</span>
      <span className={styles.unit}>s</span>
    </span>
  );
}

export type TimerProps = {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
  resetKey?: string | number;
  deadlineAt?: number;
  size?: "default" | "compact";
  className?: string;
};

export function Timer({
  duration,
  active,
  onTimeUp,
  onTick,
  resetKey,
  deadlineAt,
  size = "default",
  className,
}: TimerProps) {
  const { remaining, urgent, finished } = useCountdown({
    duration,
    active,
    onTimeUp,
    onTick,
    resetKey,
    deadlineAt,
    urgency: { type: "ratio", value: 0.25 },
  });

  return (
    <TimerDisplay
      duration={duration}
      remaining={remaining}
      state={finished ? "finished" : urgent ? "urgent" : "normal"}
      size={size}
      className={className}
    />
  );
}
