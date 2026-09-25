"use client";

import { motion } from "motion/react";
import { ArrowIcon } from "@/components/ui";
import styles from "./EstimationQuestion.module.css";

type EstimationQuestionProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  locked: boolean;
  onChange: (value: number) => void;
  onSubmit: (value: number) => void;
};

export function EstimationQuestion({
  min,
  max,
  step,
  value,
  unit,
  locked,
  onChange,
  onSubmit,
}: EstimationQuestionProps) {
  const adjust = (amount: number) => {
    const next = Math.min(max, Math.max(min, value + amount));
    onChange(next);
  };

  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className={`${styles.challenge}`}>
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
            onChange={(event) => {
              const next = Number(event.target.value);
              onChange(next);
            }}
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
