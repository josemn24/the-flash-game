"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CrossIcon } from "@/components/ui";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import type { ServerMatchingPair, ServerMatchingProgress } from "@/types/gameplay/challenge";
import type { MatchingItem, MatchingLeftItem } from "@/types/question";
import styles from "./MatchingQuestion.module.css";

type PublicLeftItem = Omit<MatchingLeftItem, "correctMatchId">;

export function ServerMatchingQuestion({
  leftItems,
  rightItems,
  progress,
  locked,
  matchingState,
  matchingStatusVisible,
  matchingError,
  lastPair,
  onPair,
  onRetry,
}: {
  readonly leftItems: readonly PublicLeftItem[];
  readonly rightItems: readonly MatchingItem[];
  readonly progress: ServerMatchingProgress;
  readonly locked: boolean;
  readonly matchingState: "idle" | "submitting" | "error";
  readonly matchingStatusVisible: boolean;
  readonly matchingError?: string;
  readonly lastPair?: ServerMatchingPair & { readonly correct: boolean };
  readonly onPair: (leftId: string, rightId: string) => void;
  readonly onRetry?: () => void;
}) {
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [dismissedPairKey, setDismissedPairKey] = useState<string | null>(null);
  const matchedLeftIds = new Set(progress.matchedPairs.map((pair) => pair.leftId));
  const matchedRightIds = new Set(progress.matchedPairs.map((pair) => pair.rightId));
  const lastPairKey = lastPair ? `${lastPair.leftId}:${lastPair.rightId}` : null;
  const invalidPair =
    lastPair && !lastPair.correct && dismissedPairKey !== lastPairKey ? lastPair : null;
  const announcement = lastPair
    ? lastPair.correct
      ? `Pareja correcta. ${progress.matchedCount} de ${progress.totalPairs} resueltas.`
      : "No forman una pareja. Puedes volver a intentarlo."
    : "Selecciona una tarjeta de cada columna.";

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!lastPair || lastPair.correct) return;
    resetTimeoutRef.current = setTimeout(() => {
      setDismissedPairKey(`${lastPair.leftId}:${lastPair.rightId}`);
      setSelectedLeft(null);
      setSelectedRight(null);
    }, 550);
  }, [lastPair]);

  const choosePair = (leftId: string, rightId: string) => {
    if (locked || invalidPair || matchingState === "submitting") return;
    onPair(leftId, rightId);
  };

  const chooseLeft = (id: string) => {
    if (locked || invalidPair || matchedLeftIds.has(id)) return;
    setSelectedLeft(id);
    if (selectedRight) choosePair(id, selectedRight);
  };

  const chooseRight = (id: string) => {
    if (locked || invalidPair || matchedRightIds.has(id)) return;
    setSelectedRight(id);
    if (selectedLeft) choosePair(selectedLeft, id);
  };

  const status =
    matchingState === "submitting" && matchingStatusVisible
      ? "Comprobando pareja…"
      : (matchingError ?? "");

  return (
    <div className={styles.root}>
      <div className={styles.scoreRow}>
        <span>
          {progress.matchedCount} de {progress.totalPairs} parejas
        </span>
        <strong>
          {progress.incorrectAttempts} {progress.incorrectAttempts === 1 ? "error" : "errores"}
        </strong>
      </div>
      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="server-matching-left-heading">
          <h3 id="server-matching-left-heading">Conceptos</h3>
          {leftItems.map((item) => {
            const matched = matchedLeftIds.has(item.id);
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
        <section className={styles.column} aria-labelledby="server-matching-right-heading">
          <h3 id="server-matching-right-heading">Parejas</h3>
          {rightItems.map((item) => {
            const matched = matchedRightIds.has(item.id);
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
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="mt-4" aria-busy={matchingState === "submitting"}>
        {status ? (
          <p role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
        {matchingState === "error" && onRetry ? (
          <button type="button" className="text-sm underline" onClick={onRetry}>
            Reintentar pareja
          </button>
        ) : null}
      </div>
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
  readonly item: PublicLeftItem | MatchingItem;
  readonly selected: boolean;
  readonly matched: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
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
        {item.icon ? (
          <span className={styles.cardIcon} aria-hidden="true">
            {item.icon}
          </span>
        ) : null}
        <span>{item.label}</span>
      </span>
      {matched ? <CheckIcon className={styles.stateIcon} aria-hidden="true" /> : null}
      {invalid ? <CrossIcon className={styles.stateIcon} aria-hidden="true" /> : null}
    </motion.button>
  );
}
