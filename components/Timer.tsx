"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import styles from "@/components/Timer.module.css";

type TimerProps = {
  duration: number;
  active: boolean;
  onTimeUp: () => void;
  onTick?: (remaining: number) => void;
};

export function Timer({ duration, active, onTimeUp, onTick }: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const onTimeUpRef = useRef(onTimeUp);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTickRef.current = onTick;
  }, [onTimeUp, onTick]);

  useEffect(() => {
    if (!active) return;

    const endAt = performance.now() + duration * 1000;
    let frameId = 0;
    let finished = false;

    const update = () => {
      const next = Math.max(0, (endAt - performance.now()) / 1000);
      setRemaining(next);
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
  }, [duration, active]);

  const ratio = remaining / duration;
  const urgent = remaining <= 5;
  const display = Math.ceil(remaining);
  const circumference = 2 * Math.PI * 27;

  return (
    <motion.div
      className={`${styles.shell} ${urgent ? styles.urgent : ""}`}
      animate={urgent ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.65, repeat: Infinity } : undefined}
      aria-label={`${display} segundos restantes`}
      role="timer"
    >
      <svg className="h-[68px] w-[68px] -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
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
      <span className="absolute inset-0 grid place-items-center font-mono text-xl font-black tabular-nums">
        {display}
      </span>
    </motion.div>
  );
}
