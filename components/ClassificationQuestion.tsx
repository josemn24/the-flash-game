"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import styles from "@/components/ClassificationQuestion.module.css";
import { MotionButton } from "@/components/ui";
import type { ClassificationAnswer, ClassificationItem, QuestionVariant } from "@/types/game";

type ClassificationQuestionProps = {
  items: ClassificationItem[];
  categories: string[];
  initialAnswer?: ClassificationAnswer;
  locked: boolean;
  onProgress?: (answer: ClassificationAnswer) => void;
  onSubmit: (answer: ClassificationAnswer) => void;
  variant?: QuestionVariant;
};

function categoryLabel(category: string) {
  return category.charAt(0).toLocaleUpperCase("es") + category.slice(1);
}

export function ClassificationQuestion({
  items,
  categories,
  initialAnswer,
  locked,
  onProgress,
  onSubmit,
  variant = "default",
}: ClassificationQuestionProps) {
  const [answers, setAnswers] = useState<ClassificationAnswer>(initialAnswer ?? {});
  const answeredCount = items.filter((item) => answers[item.label]).length;
  const complete = answeredCount === items.length;
  const isBinary = categories.length === 2;
  const categoryGridStyle = { "--category-count": categories.length } as CSSProperties;

  const chooseCategory = (item: ClassificationItem, category: string) => {
    if (locked) return;
    setAnswers((current) => {
      const next = { ...current, [item.label]: category };
      onProgress?.(next);
      return next;
    });
  };

  return (
    <div className={`${styles.root}`} data-format="classification" data-variant={variant}>
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

      {isBinary ? (
        <div className={styles.binaryList}>
          <div className={styles.binaryHeader} aria-hidden="true">
            <span>Elemento</span>
            {categories.map((category) => (
              <span
                key={category}
                className={styles.categoryHeading}
                data-role="classification-category"
              >
                {categoryLabel(category)}
              </span>
            ))}
          </div>

          {items.map((item, itemIndex) => (
            <motion.div
              key={item.label}
              className={styles.binaryRow}
              role="group"
              aria-label={`Clasificar ${item.label}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(itemIndex * 0.025, 0.15), duration: 0.18 }}
            >
              <strong className={styles.binaryItemLabel}>{item.label}</strong>
              {categories.map((category) => {
                const selected = answers[item.label] === category;

                return (
                  <motion.button
                    key={category}
                    type="button"
                    className={`${styles.binaryChoice} ${selected ? styles.binaryChoiceSelected : ""}`}
                    disabled={locked}
                    aria-pressed={selected}
                    aria-label={`Clasificar ${item.label} como ${categoryLabel(category)}`}
                    onClick={() => chooseCategory(item, category)}
                    whileTap={locked ? undefined : { scale: 0.94 }}
                  >
                    {selected ? (
                      <CheckIcon className={styles.binaryCheckIcon} aria-hidden="true" />
                    ) : (
                      <span className={styles.emptyChoice} aria-hidden="true" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className={styles.matrix} style={categoryGridStyle}>
          <div className={styles.matrixHeader} aria-hidden="true">
            <span>Elemento</span>
            {categories.map((category) => (
              <span
                key={category}
                className={styles.categoryHeading}
                data-role="classification-category"
              >
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
      )}

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
