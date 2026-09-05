"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import styles from "./MatchingQuestion.module.css";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import type { MatchingAnswer, MatchingItem, MatchingLeftItem, QuestionVariant } from "@/types/game";

type MatchingQuestionProps = {
  leftItems: MatchingLeftItem[];
  rightItems: MatchingItem[];
  initialAnswer?: MatchingAnswer;
  locked: boolean;
  onProgress: (answer: MatchingAnswer) => void;
  onIncorrectAttempt: () => void;
  onSubmit: (answer: MatchingAnswer) => void;
  variant?: QuestionVariant;
};

type InvalidPair = { leftId: string; rightId: string };

export function MatchingQuestion({
  leftItems,
  rightItems,
  initialAnswer,
  locked,
  onProgress,
  onIncorrectAttempt,
  onSubmit,
  variant = "default",
}: MatchingQuestionProps) {
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [matches, setMatches] = useState<MatchingAnswer>(() => {
    const validRightIds = new Set(rightItems.map((item) => item.id));
    return Object.fromEntries(
      Object.entries(initialAnswer ?? {}).filter(
        ([leftId, rightId]) =>
          leftItems.some((item) => item.id === leftId) && validRightIds.has(rightId),
      ),
    );
  });
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [invalidPair, setInvalidPair] = useState<InvalidPair | null>(null);
  const [announcement, setAnnouncement] = useState("Selecciona una tarjeta de cada columna.");

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    },
    [],
  );

  const completeAttempt = (leftId: string, rightId: string) => {
    const leftItem = leftItems.find((item) => item.id === leftId);
    const rightItem = rightItems.find((item) => item.id === rightId);
    if (!leftItem || !rightItem) return;

    if (leftItem.correctMatchId === rightId) {
      const nextMatches = { ...matches, [leftId]: rightId };
      setMatches(nextMatches);
      setSelectedLeft(null);
      setSelectedRight(null);
      onProgress(nextMatches);
      setAnnouncement(`Pareja correcta: ${leftItem.label} y ${rightItem.label}.`);
      if (Object.keys(nextMatches).length === leftItems.length) onSubmit(nextMatches);
      return;
    }

    setInvalidPair({ leftId, rightId });
    onIncorrectAttempt();
    setAnnouncement(`${leftItem.label} y ${rightItem.label} no forman una pareja.`);
    resetTimeoutRef.current = setTimeout(() => {
      setInvalidPair(null);
      setSelectedLeft(null);
      setSelectedRight(null);
    }, 550);
  };

  const chooseLeft = (id: string) => {
    if (locked || invalidPair || matches[id]) return;
    setSelectedLeft(id);
    if (selectedRight) completeAttempt(id, selectedRight);
  };

  const chooseRight = (id: string) => {
    if (locked || invalidPair || Object.values(matches).includes(id)) return;
    setSelectedRight(id);
    if (selectedLeft) completeAttempt(selectedLeft, id);
  };

  const matchedCount = Object.keys(matches).length;

  return (
    <div className={`${styles.root}`} data-variant={variant ?? "default"}>
      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="matching-left-heading">
          <h3 id="matching-left-heading">Conceptos</h3>
          {leftItems.map((item) => {
            const matched = Boolean(matches[item.id]);
            const selected = selectedLeft === item.id;
            const invalid = invalidPair?.leftId === item.id;
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selected}
                matched={matched}
                invalid={invalid}
                disabled={locked || matched || Boolean(invalidPair)}
                onClick={() => chooseLeft(item.id)}
              />
            );
          })}
        </section>

        <section className={styles.column} aria-labelledby="matching-right-heading">
          <h3 id="matching-right-heading">Parejas</h3>
          {rightItems.map((item) => {
            const matched = Object.values(matches).includes(item.id);
            const selected = selectedRight === item.id;
            const invalid = invalidPair?.rightId === item.id;
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selected}
                matched={matched}
                invalid={invalid}
                disabled={locked || matched || Boolean(invalidPair)}
                onClick={() => chooseRight(item.id)}
              />
            );
          })}
        </section>
      </div>

      {matchedCount > 0 && (
        <div className={styles.completedList} aria-label="Parejas completadas">
          {leftItems
            .filter((item) => matches[item.id])
            .map((item) => (
              <span key={item.id}>
                <CheckIcon aria-hidden="true" />
                {item.label} — {rightItems.find((right) => right.id === matches[item.id])?.label}
              </span>
            ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function MatchingCard({
  item,
  selected,
  matched,
  invalid,
  disabled,
  onClick,
}: {
  item: MatchingItem;
  selected: boolean;
  matched: boolean;
  invalid: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`${styles.card} ${item.media ? styles.cardWithMedia : ""} ${selected ? styles.cardSelected : ""} ${matched ? styles.cardMatched : ""} ${invalid ? styles.cardInvalid : ""}`}
      disabled={disabled}
      aria-label={item.label}
      aria-pressed={selected}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      {item.media && <QuestionMedia media={item.media} compact />}
      <span className={`${styles.cardLabel} ${item.icon ? styles.cardLabelWithIcon : ""}`}>
        {item.icon && (
          <span className={styles.cardIcon} aria-hidden="true">
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
      </span>
      {matched && <CheckIcon className={styles.stateIcon} aria-hidden="true" />}
      {invalid && <CrossIcon className={styles.stateIcon} aria-hidden="true" />}
    </motion.button>
  );
}
