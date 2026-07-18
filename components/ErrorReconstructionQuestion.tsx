"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import styles from "@/components/ErrorReconstructionQuestion.module.css";
import { MotionButton } from "@/components/ui/MotionButton.client";
import type { ErrorReconstructionAnswer, ErrorReconstructionQuestion } from "@/types/game";

type Props = {
  question: ErrorReconstructionQuestion;
  locked: boolean;
  onProgress: (answer: ErrorReconstructionAnswer) => void;
  onSubmit: (answer: ErrorReconstructionAnswer) => void;
};

export function ErrorReconstructionQuestionInput({
  question,
  locked,
  onProgress,
  onSubmit,
}: Props) {
  const [stepId, setStepId] = useState<string>();
  const [correction, setCorrection] = useState<string>();

  useEffect(() => {
    if (stepId) onProgress({ stepId, ...(correction ? { correction } : {}) });
  }, [correction, onProgress, stepId]);

  return (
    <div className={styles.root}>
      <p className={styles.instruction}>
        Selecciona el primer paso en el que el razonamiento deja de ser válido.
      </p>
      <ol className={styles.steps}>
        {question.steps.map((step, index) => {
          const selected = step.id === stepId;
          return (
            <li key={step.id}>
              <motion.button
                type="button"
                className={`${styles.step} ${selected ? styles.stepSelected : ""}`}
                disabled={locked}
                aria-pressed={selected}
                onClick={() => !locked && setStepId(step.id)}
                whileTap={locked ? undefined : { scale: 0.985 }}
              >
                <span className={styles.stepNumber}>{index + 1}</span>
                <span>{step.text}</span>
              </motion.button>
            </li>
          );
        })}
      </ol>
      {question.correction && stepId && (
        <fieldset className={styles.correction} disabled={locked}>
          <legend>
            ¿Cuál sería la corrección? <span>Opcional</span>
          </legend>
          <div className={styles.options}>
            {question.correction.options.map((option, index) => {
              const selected = correction === option;
              return (
                <motion.button
                  key={option}
                  type="button"
                  className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                  aria-pressed={selected}
                  onClick={() => setCorrection(option)}
                  whileTap={locked ? undefined : { scale: 0.985 }}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      )}
      <MotionButton
        className={styles.confirm}
        disabled={locked || !stepId}
        onClick={() => stepId && onSubmit({ stepId, ...(correction ? { correction } : {}) })}
        whileTap={{ scale: 0.985 }}
      >
        Confirmar primer error
      </MotionButton>
    </div>
  );
}
