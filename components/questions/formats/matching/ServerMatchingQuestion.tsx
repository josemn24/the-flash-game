"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CheckIcon } from "@/components/ui";
import { ServerOperationStatus } from "@/components/questions/shared";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import type { AnswerValue, MatchingAnswer } from "@/types/game";
import type { MatchingItem, MatchingLeftItem } from "@/types/question";
import styles from "./MatchingQuestion.module.css";

type PublicLeftItem = Omit<MatchingLeftItem, "correctMatchId">;

function isMatchingAnswer(answer: AnswerValue | null | undefined): answer is MatchingAnswer {
  return (
    answer !== null &&
    answer !== undefined &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

function normalizeDraft(
  answer: AnswerValue | null | undefined,
  leftItems: readonly PublicLeftItem[],
  rightItems: readonly MatchingItem[],
): MatchingAnswer {
  if (!isMatchingAnswer(answer)) return {};
  const rightIds = new Set(rightItems.map((item) => item.id));
  const leftIds = new Set(leftItems.map((item) => item.id));
  return Object.fromEntries(
    Object.entries(answer).filter(
      ([leftId, rightId]) => leftIds.has(leftId) && rightIds.has(rightId),
    ),
  );
}

export function ServerMatchingQuestion({
  leftItems,
  rightItems,
  pendingAnswer,
  locked,
  submissionState,
  submissionStatusVisible,
  submissionError,
  onSubmit,
  onProgress,
  onRetry,
}: {
  readonly leftItems: readonly PublicLeftItem[];
  readonly rightItems: readonly MatchingItem[];
  readonly pendingAnswer?: AnswerValue | null;
  readonly locked: boolean;
  readonly submissionState: "idle" | "submitting" | "error";
  readonly submissionStatusVisible: boolean;
  readonly submissionError?: string;
  readonly onSubmit: (answer: MatchingAnswer) => void;
  readonly onProgress: (answer: MatchingAnswer) => void;
  readonly onRetry?: () => void;
}) {
  const [draft, setDraft] = useState<MatchingAnswer>(() =>
    normalizeDraft(pendingAnswer, leftItems, rightItems),
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const disabled = locked || submissionState === "submitting";

  const matchedRightIds = useMemo(() => new Set(Object.values(draft)), [draft]);
  const complete = leftItems.length > 0 && Object.keys(draft).length === leftItems.length;

  const updateDraft = (nextDraft: MatchingAnswer) => {
    setDraft(nextDraft);
    onProgress(nextDraft);
  };

  const pair = (leftId: string, rightId: string) => {
    const nextDraft = { ...draft };
    for (const [existingLeftId, existingRightId] of Object.entries(nextDraft)) {
      if (existingLeftId === leftId || existingRightId === rightId) {
        delete nextDraft[existingLeftId];
      }
    }
    nextDraft[leftId] = rightId;
    updateDraft(nextDraft);
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const chooseLeft = (leftId: string) => {
    if (disabled) return;
    if (selectedRight) {
      pair(leftId, selectedRight);
      return;
    }
    if (draft[leftId]) {
      const nextDraft = { ...draft };
      delete nextDraft[leftId];
      updateDraft(nextDraft);
    }
    setSelectedLeft(leftId);
    setSelectedRight(null);
  };

  const chooseRight = (rightId: string) => {
    if (disabled) return;
    if (selectedLeft) {
      pair(selectedLeft, rightId);
      return;
    }
    const existingLeftId = Object.entries(draft).find(([, value]) => value === rightId)?.[0];
    if (existingLeftId) {
      const nextDraft = { ...draft };
      delete nextDraft[existingLeftId];
      updateDraft(nextDraft);
      setSelectedLeft(existingLeftId);
    } else {
      setSelectedRight(rightId);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.columns}>
        <section className={styles.column} aria-labelledby="server-matching-left-heading">
          <h3 id="server-matching-left-heading">Conceptos</h3>
          {leftItems.map((item) => {
            const matched = item.id in draft;
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selectedLeft === item.id}
                matched={matched}
                disabled={disabled}
                onClick={() => chooseLeft(item.id)}
              />
            );
          })}
        </section>
        <section className={styles.column} aria-labelledby="server-matching-right-heading">
          <h3 id="server-matching-right-heading">Parejas</h3>
          {rightItems.map((item) => {
            const matched = matchedRightIds.has(item.id);
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selectedRight === item.id}
                matched={matched}
                disabled={disabled}
                onClick={() => chooseRight(item.id)}
              />
            );
          })}
        </section>
      </div>

      <div className={styles.completedList} aria-label="Progreso de parejas">
        <span>
          <strong>
            {Object.keys(draft).length}/{leftItems.length}
          </strong>{" "}
          parejas seleccionadas
        </span>
        {Object.entries(draft).map(([leftId, rightId]) => {
          const left = leftItems.find((item) => item.id === leftId);
          const right = rightItems.find((item) => item.id === rightId);
          return left && right ? (
            <span key={`${leftId}:${rightId}`}>
              <CheckIcon aria-hidden="true" />
              {left.label} — {right.label}
            </span>
          ) : null;
        })}
      </div>

      <div className={styles.checkRow}>
        <button
          type="button"
          className={styles.checkButton}
          disabled={disabled || !complete}
          onClick={() => onSubmit(draft)}
        >
          Comprobar parejas
        </button>
        {!complete ? (
          <span className={styles.checkHint}>
            Completa todas las parejas para comprobar la respuesta.
          </span>
        ) : null}
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {complete
          ? "Todas las tarjetas están asociadas. Puedes comprobar las parejas."
          : `${Object.keys(draft).length} de ${leftItems.length} parejas seleccionadas.`}
      </p>
      <ServerOperationStatus
        state={submissionState}
        visible={submissionStatusVisible}
        pendingMessage="Comprobando parejas…"
        errorMessage={submissionError ?? "No hemos podido confirmar las parejas."}
        retryLabel="Reintentar"
        onRetry={onRetry}
      />
    </div>
  );
}

function MatchingCard({
  item,
  selected,
  matched,
  disabled,
  onClick,
}: {
  readonly item: PublicLeftItem | MatchingItem;
  readonly selected: boolean;
  readonly matched: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`${styles.card} ${item.media ? styles.cardWithMedia : ""} ${selected ? styles.cardSelected : ""} ${matched ? styles.cardMatched : ""}`}
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
    </motion.button>
  );
}
