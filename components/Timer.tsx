"use client";

import { motion } from "motion/react";
import styles from "@/components/Timer.module.css";
import { useCountdown } from "@/features/game/useCountdown";

type TimerProps = {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
  resetKey?: string | number;
  deadlineAt?: number;
  size?: "default" | "compact";
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
  const { ratio, urgent, display } = useCountdown({
    duration,
    active,
    onTimeUp,
    onTick,
    resetKey,
    deadlineAt,
    urgency: { type: "seconds", value: 5 },
  });
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
