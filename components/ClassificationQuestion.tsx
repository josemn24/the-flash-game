"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import styles from "@/components/ClassificationQuestion.module.css";
import { MotionButton } from "@/components/ui/MotionButton.client";
import type { ClassificationAnswer, ClassificationItem } from "@/types/game";

type ClassificationQuestionProps = {
  items: ClassificationItem[];
  categories: string[];
  locked: boolean;
  onSubmit: (answer: ClassificationAnswer) => void;
};

function categoryLabel(category: string) {
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

export function ClassificationQuestion({
  items,
  categories,
  locked,
  onSubmit,
}: ClassificationQuestionProps) {
  const [answers, setAnswers] = useState<ClassificationAnswer>({});
  const answeredCount = items.filter((item) => answers[item.label]).length;
  const complete = answeredCount === items.length;

  const chooseCategory = (item: ClassificationItem, category: string) => {
    if (locked) return;
    setAnswers((current) => ({ ...current, [item.label]: category }));
  };

  return (
    <div className={styles.root}>
      <div className={styles.progressHeader}>
        <span>Clasificación</span>
        <span>
          {answeredCount} de {items.length} clasificados
        </span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Progreso de la clasificación"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={answeredCount}
      >
        <motion.span
          className={styles.progressValue}
          animate={{ width: `${(answeredCount / items.length) * 100}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </div>

      <div className={styles.matrix}>
        <div className={styles.matrixHeader} aria-hidden="true">
          <span>Ser vivo</span>
          {categories.map((category) => (
            <span key={category} className={styles.categoryHeading}>
              {categoryLabel(category)}
            </span>
          ))}
        </div>

        <div className={styles.rows}>
          {items.map((item, itemIndex) => (
            <motion.div
              key={item.label}
              className={styles.row}
              role="group"
              aria-label={`Clasificar ${item.label}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(itemIndex * 0.025, 0.15), duration: 0.18 }}
            >
              <strong className={styles.itemLabel}>{item.label}</strong>
              {categories.map((category) => {
                const selected = answers[item.label] === category;

                return (
                  <motion.button
                    key={category}
                    type="button"
                    className={`${styles.choiceButton} ${selected ? styles.choiceButtonSelected : ""}`}
                    disabled={locked}
                    aria-pressed={selected}
                    aria-label={`Clasificar ${item.label} como ${categoryLabel(category)}`}
                    onClick={() => chooseCategory(item, category)}
                    whileTap={locked ? undefined : { scale: 0.92 }}
                  >
                    {selected ? (
                      <motion.span
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        aria-hidden="true"
                      >
                        <CheckIcon className={styles.checkIcon} />
                      </motion.span>
                    ) : (
                      <span className={styles.emptyChoice} aria-hidden="true" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>

      <MotionButton
        className={styles.confirmButton}
        disabled={locked || !complete}
        onClick={() => onSubmit({ ...answers })}
        whileTap={{ scale: 0.985 }}
      >
        Confirmar clasificación
      </MotionButton>
    </div>
  );
}
