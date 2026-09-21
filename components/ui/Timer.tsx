"use client";

import type { CSSProperties } from "react";
import {
  getCountdownMetrics,
  useCountdown,
  type CountdownUrgency,
} from "@/features/game/useCountdown";
import styles from "./Timer.module.css";

export type { CountdownUrgency } from "@/features/game/useCountdown";

export type TimerDisplayProps = {
  duration: number;
  remaining: number;
  state?: "auto" | "normal" | "urgent" | "finished";
  urgency?: CountdownUrgency;
  size?: "default" | "compact";
  className?: string;
};

export function TimerDisplay({
  duration,
  remaining,
  state = "auto",
  urgency,
  size = "default",
  className,
}: TimerDisplayProps) {
  const metrics = getCountdownMetrics(duration, remaining, urgency);
  const resolvedState =
    state === "auto"
      ? metrics.finished
        ? "finished"
        : metrics.urgent
          ? "urgent"
          : "normal"
      : state;
  const display = metrics.display;
  const label = resolvedState === "finished" ? "Tiempo agotado" : `${display} segundos restantes`;

  return (
    <span
      className={`${styles.timer} ${styles[resolvedState]} ${size === "compact" ? styles.compact : ""} ${className ?? ""}`}
      style={{ "--timer-ratio": metrics.ratio } as CSSProperties}
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
  urgency?: CountdownUrgency;
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
  urgency,
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
    urgency,
  });

  return (
    <TimerDisplay
      duration={duration}
      remaining={remaining}
      state={finished ? "finished" : urgent ? "urgent" : "normal"}
      urgency={urgency}
      size={size}
      className={className}
    />
  );
}
