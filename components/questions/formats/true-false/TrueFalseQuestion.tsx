"use client";

import { motion } from "motion/react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import styles from "./TrueFalseQuestion.module.css";

export function TrueFalseQuestion({
  locked,
  onSubmit,
}: {
  locked: boolean;
  onSubmit: (answer: boolean) => void;
}) {
  return (
    <div
      className={`${styles.root}`}
      role="group"
      aria-label="Opciones de respuesta"
    >
      <motion.button
        type="button"
        className={`${styles.button} ${styles.trueButton}`}
        disabled={locked}
        onClick={() => onSubmit(true)}
        whileTap={locked ? undefined : { scale: 0.97 }}
      >
        <CheckIcon aria-hidden="true" />
        <span>Verdadero</span>
      </motion.button>
      <motion.button
        type="button"
        className={`${styles.button} ${styles.falseButton}`}
        disabled={locked}
        onClick={() => onSubmit(false)}
        whileTap={locked ? undefined : { scale: 0.97 }}
      >
        <CrossIcon aria-hidden="true" />
        <span>Falso</span>
      </motion.button>
    </div>
  );
}
