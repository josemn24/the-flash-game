"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/Timer.module.css";

type TimerProps = {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
  resetKey?: string | number;
  deadlineAt?: number;
  size?: "default" | "compact";
};

type TimerState = {
  duration: number;
  remaining: number;
  resetKey?: string | number;
};

export function Timer({
  duration,
  active,
  onTimeUp,
  onTick,
  resetKey,
  deadlineAt,
  size = "default",
}: TimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
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
    let finished = false;

    const update = () => {
      const next = Math.max(0, (endAt - Date.now()) / 1000);
      setTimerState({ duration, remaining: next, resetKey });
      onTickRef.current?.(next);

      if (next <= 0) {
        if (!finished) {
          finished = true;
          onTimeUpRef.current();
        }
        return;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [deadlineAt, duration, active, resetKey]);

  const isCurrentTimerState = timerState.duration === duration && timerState.resetKey === resetKey;
  const visibleRemaining = active && isCurrentTimerState ? timerState.remaining : duration;
  const ratio = Math.min(1, Math.max(0, visibleRemaining / duration));
  const urgent = visibleRemaining <= 5;
  const display = Math.ceil(visibleRemaining);
  const circumference = 2 * Math.PI * 27;

  return (
    <motion.div
      className={`${styles.shell} ${size === "compact" ? styles.compact : ""} ${urgent ? styles.urgent : ""}`}
      animate={urgent ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.65, repeat: Infinity } : undefined}
      aria-label={`${display} segundos restantes`}
      role="timer"
    >
      <svg className={styles.ring} viewBox="0 0 64 64" aria-hidden="true">
        <circle className={styles.track} cx="32" cy="32" r="27" />
        <circle
          className={styles.progress}
          cx="32"
          cy="32"
          r="27"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span className={styles.value}>{display}</span>
    </motion.div>
  );
}
