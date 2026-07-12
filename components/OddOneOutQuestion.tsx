"use client";

import { motion } from "motion/react";
import { QuestionMedia } from "@/components/QuestionMedia";
import styles from "@/components/OddOneOutQuestion.module.css";
import type { OddOneOutItem } from "@/types/game";

type OddOneOutQuestionProps = {
  items: OddOneOutItem[];
  locked: boolean;
  onSubmit: (answer: string) => void;
};

export function OddOneOutQuestion({ items, locked, onSubmit }: OddOneOutQuestionProps) {
  return (
    <div className={styles.grid} aria-label="Opciones: encuentra el intruso">
      {items.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          className={styles.card}
          disabled={locked}
          onClick={() => onSubmit(item.id)}
          whileHover={locked ? undefined : { y: -3 }}
          whileTap={locked ? undefined : { scale: 0.98 }}
        >
          {item.media && <QuestionMedia media={item.media} compact />}
          <span className={styles.label}>{item.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
