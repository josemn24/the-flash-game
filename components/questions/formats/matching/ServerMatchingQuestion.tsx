"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ServerOperationStatus } from "@/components/questions/shared";
import { QuestionMedia } from "@/components/questions/shared/QuestionMedia";
import type { AnswerValue, MatchingAnswer } from "@/types/game";
import type { MatchingItem, MatchingLeftItem } from "@/types/question";
import styles from "./MatchingQuestion.module.css";
import {
  getMatchingPairPresentation,
  type MatchingPairPresentation,
} from "./matchingPairPresentation";

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
  const [announcement, setAnnouncement] = useState("Selecciona una tarjeta de cada columna.");
  const disabled = locked || submissionState === "submitting";

  const pairPresentation = useMemo(
    () => getMatchingPairPresentation(leftItems, draft),
    [draft, leftItems],
  );
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

    const left = leftItems.find((item) => item.id === leftId);
    const right = rightItems.find((item) => item.id === rightId);
    const pairNumber = leftItems.findIndex((item) => item.id === leftId) + 1;
    if (left && right) {
      setAnnouncement(
        Object.keys(nextDraft).length === leftItems.length
          ? "Todas las asociaciones están preparadas. Puedes comprobarlas."
          : `Asociación ${pairNumber} preparada: ${left.label} con ${right.label}. Pendiente de comprobación.`,
      );
    }
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
      setAnnouncement("Asociación retirada. Selecciona otra tarjeta para volver a prepararla.");
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
      setAnnouncement("Asociación retirada. Selecciona una nueva tarjeta para reemplazarla.");
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
            const pair = pairPresentation.byLeft[item.id];
            const right = pair
              ? rightItems.find((rightItem) => rightItem.id === pair.rightId)
              : null;
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selectedLeft === item.id}
                pair={pair}
                pairLabel={right?.label}
                disabled={disabled}
                onClick={() => chooseLeft(item.id)}
              />
            );
          })}
        </section>
        <section className={styles.column} aria-labelledby="server-matching-right-heading">
          <h3 id="server-matching-right-heading">Parejas</h3>
          {rightItems.map((item) => {
            const pair = pairPresentation.byRight[item.id];
            const left = pair ? leftItems.find((leftItem) => leftItem.id === pair.leftId) : null;
            return (
              <MatchingCard
                key={item.id}
                item={item}
                selected={selectedRight === item.id}
                pair={pair}
                pairLabel={left?.label}
                disabled={disabled}
                onClick={() => chooseRight(item.id)}
              />
            );
          })}
        </section>
      </div>

      <div className={styles.completedList} aria-label="Asociaciones pendientes de comprobación">
        <span>
          <strong>
            {Object.keys(draft).length}/{leftItems.length}
          </strong>{" "}
          asociaciones preparadas
        </span>
        {leftItems.map((left) => {
          const pair = pairPresentation.byLeft[left.id];
          const right = pair ? rightItems.find((item) => item.id === pair.rightId) : null;
          return pair && right ? (
            <span
              key={`${pair.leftId}:${pair.rightId}`}
              className={styles.pairSummary}
              data-pair-state="pending"
              data-pair-number={pair.pairNumber}
              data-pair-tone={pair.pairTone}
            >
              <span className={styles.pairBadge} aria-hidden="true">
                {pair.pairNumber}
              </span>
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
        {announcement}
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
  pair,
  pairLabel,
  disabled,
  onClick,
}: {
  readonly item: PublicLeftItem | MatchingItem;
  readonly selected: boolean;
  readonly pair?: MatchingPairPresentation;
  readonly pairLabel?: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const pendingLabel = pair
    ? `${item.label}, asociación ${pair.pairNumber}${pairLabel ? ` con ${pairLabel}` : ""}, pendiente de comprobación`
    : item.label;

  return (
    <motion.button
      type="button"
      className={`${styles.card} ${item.media ? styles.cardWithMedia : ""} ${selected ? styles.cardSelected : ""} ${pair ? styles.cardPendingPair : ""}`}
      disabled={disabled}
      aria-label={pendingLabel}
      aria-pressed={selected}
      data-pair-state={pair ? "pending" : undefined}
      data-pair-number={pair?.pairNumber}
      data-pair-tone={pair?.pairTone}
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
      {pair ? (
        <span className={styles.pairBadge} aria-hidden="true">
          {pair.pairNumber}
        </span>
      ) : null}
    </motion.button>
  );
}
