"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ArrowIcon } from "@/components/icons";
import styles from "@/components/EstimationQuestion.module.css";
import type { QuestionVariant } from "@/types/game";

type EstimationQuestionProps = {
  min: number;
  max: number;
  step: number;
  initialValue: number;
  unit: string;
  locked: boolean;
  onSubmit: (value: number) => void;
  variant?: QuestionVariant;
};

export function EstimationQuestion({
  min,
  max,
  step,
  initialValue,
  unit,
  locked,
  onSubmit,
  variant = "default",
}: EstimationQuestionProps) {
  const [value, setValue] = useState(initialValue);

  const adjust = (amount: number) => {
    setValue((current) => Math.min(max, Math.max(min, current + amount)));
  };

  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div
      className={`${styles.challenge} ${variant === "flash-pop" ? styles.pop : ""}`}
      data-variant={variant}
    >
      <div className={styles.valueDisplay} aria-live="polite">
        <span>Tu estimación</span>
        <strong>
          {value}
          <small>{unit}</small>
        </strong>
      </div>

      <div className={styles.controls}>
        <div className={styles.rangeWrap}>
          <input
            className={styles.range}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={locked}
            onChange={(event) => setValue(Number(event.target.value))}
            style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
            aria-label={`Estimación en ${unit}`}
            aria-valuetext={`${value} ${unit}`}
          />
          <div className={styles.limits} aria-hidden="true">
            <span>
              {min} {unit}
            </span>
            <span>
              {max} {unit}
            </span>
          </div>
        </div>

        <div className={styles.adjustRow}>
          <motion.button
            type="button"
            className={styles.adjustButton}
            disabled={locked || value <= min}
            onClick={() => adjust(-step)}
            whileTap={{ scale: 0.94 }}
            aria-label={`Restar ${step} ${unit}`}
          >
            <span aria-hidden="true">−</span>
          </motion.button>

          <motion.button
            type="button"
            className={styles.adjustButton}
            disabled={locked || value >= max}
            onClick={() => adjust(step)}
            whileTap={{ scale: 0.94 }}
            aria-label={`Sumar ${step} ${unit}`}
          >
            <span aria-hidden="true">+</span>
          </motion.button>
        </div>
      </div>

      <p className={styles.hint}>Cuanto más cerca, más puntos. No resta.</p>

      <motion.button
        type="button"
        className={styles.submitButton}
        disabled={locked}
        onClick={() => onSubmit(value)}
        whileTap={{ scale: 0.97 }}
      >
        Confirmar estimación
        <ArrowIcon className="h-5 w-5" />
      </motion.button>
    </div>
  );
}
