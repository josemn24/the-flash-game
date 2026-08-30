"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { QuestionMedia } from "@/components/QuestionMedia";
import { CheckIcon } from "@/components/icons";
import styles from "@/components/OddOneOutQuestion.module.css";
import type { OddOneOutItem } from "@/types/game";

type OddOneOutQuestionProps = {
  items: OddOneOutItem[];
  locked: boolean;
  onSubmit: (answer: string) => void;
  variant?: "flash-pop";
};

export function OddOneOutQuestion({ items, locked, onSubmit, variant }: OddOneOutQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div
      className={`${styles.grid} ${variant === "flash-pop" ? styles.pop : ""}`}
      aria-label="Opciones: encuentra el intruso"
    >
      {items.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          className={styles.card}
          disabled={locked}
          aria-pressed={selected === item.id}
          onClick={() => {
            setSelected(item.id);
            onSubmit(item.id);
          }}
          whileHover={locked ? undefined : { y: -3 }}
          whileTap={locked ? undefined : { scale: 0.98 }}
        >
          {item.media && <QuestionMedia media={item.media} compact />}
          <span className={styles.label}>
            {selected === item.id && variant === "flash-pop" ? (
              <CheckIcon aria-hidden="true" />
            ) : null}
            {item.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
