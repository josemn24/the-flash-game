"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Chip } from "@/components/ui";
import styles from "./StartCountdown.module.css";

export type StartCountdownLabel = "Flash clásico" | "Supervivencia" | "Alfabeto";

type StartCountdownProps = {
  label: StartCountdownLabel;
  onComplete: () => void;
};

export function StartCountdown({ label, onComplete }: StartCountdownProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (count === 1) onComplete();
      else setCount((value) => value - 1);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [count, onComplete]);

  return (
    <motion.div
      className={styles.countdown}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="assertive"
    >
      <Chip tone="social" className={styles.countdownChip}>
        {label}
      </Chip>
      <p>Prepárate</p>
      <AnimatePresence mode="popLayout">
        <motion.strong
          key={count}
          initial={{ opacity: 0, scale: 0.55 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.35 }}
        >
          {count}
        </motion.strong>
      </AnimatePresence>
      <span className={styles.countdownHint}>El tiempo empieza después de la cuenta atrás</span>
    </motion.div>
  );
}
