"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useState } from "react";
import { CheckIcon, CrossIcon } from "@/components/icons";
import styles from "@/components/ImageLabelingQuestion.module.css";
import type {
  ImageLabelingAnswer,
  ImageLabelingQuestion as ImageLabelingQuestionType,
} from "@/types/game";

type Props = {
  question: ImageLabelingQuestionType;
  locked: boolean;
  onSubmit: (answer: ImageLabelingAnswer) => void;
};

export function ImageLabelingReviewSurface({
  question,
  answer,
}: {
  question: ImageLabelingQuestionType;
  answer: ImageLabelingAnswer | null;
}) {
  const labelFor = (labelId: string | undefined) =>
    question.labels.find((label) => label.id === labelId)?.label;

  return (
    <>
      <div
        className={styles.surface}
        style={{ aspectRatio: `${question.surface.width} / ${question.surface.height}` }}
        role="img"
        aria-label={`${question.surface.alt} Revisión visual de las etiquetas.`}
      >
        <Image
          src={question.surface.src}
          alt=""
          fill
          sizes="(max-width: 768px) calc(100vw - 3rem), 30rem"
          unoptimized={question.surface.src.endsWith(".svg")}
          draggable={false}
        />
        <div className={styles.anchors} aria-hidden="true">
          {question.anchors.map((anchor, index) => {
            const selected = labelFor(answer?.[anchor.id]) ?? "Sin etiqueta";
            const correct = labelFor(anchor.correctLabelId) ?? "Etiqueta desconocida";
            const matches = answer?.[anchor.id] === anchor.correctLabelId;
            return (
              <div
                key={anchor.id}
                className={`${styles.reviewAnchor} ${matches ? styles.reviewCorrect : styles.reviewWrong}`}
                style={{ left: `${anchor.point.x * 100}%`, top: `${anchor.point.y * 100}%` }}
              >
                <span>{index + 1}</span>
                <strong>{matches ? correct : `Tu: ${selected}`}</strong>
                {!matches && <small>Correcta: {correct}</small>}
              </div>
            );
          })}
        </div>
      </div>
      <ol className="sr-only">
        {question.anchors.map((anchor, index) => {
          const selected = labelFor(answer?.[anchor.id]) ?? "Sin etiqueta";
          const correct = labelFor(anchor.correctLabelId) ?? "Etiqueta desconocida";
          return (
            <li key={anchor.id}>
              Zona {index + 1}. Elegida: {selected}. Correcta: {correct}.
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function ImageLabelingQuestion({ question, locked, onSubmit }: Props) {
  const [answer, setAnswer] = useState<ImageLabelingAnswer>({});
  const [selectedAnchorId, setSelectedAnchorId] = useState(question.anchors[0]?.id ?? null);
  const [announcement, setAnnouncement] = useState("Selecciona una zona y después una etiqueta.");
  const labelFor = (labelId: string | undefined) =>
    question.labels.find((label) => label.id === labelId)?.label;

  const selectAnchor = (anchorId: string, index: number) => {
    if (locked) return;
    setSelectedAnchorId(anchorId);
    setAnnouncement(
      `Zona ${index + 1} seleccionada. ${labelFor(answer[anchorId]) ?? "Sin etiqueta"}.`,
    );
  };

  const assignLabel = (labelId: string) => {
    if (locked || !selectedAnchorId) return;
    const usedByAnotherAnchor = Object.entries(answer).some(
      ([anchorId, assignedLabelId]) => anchorId !== selectedAnchorId && assignedLabelId === labelId,
    );
    if (usedByAnotherAnchor) return;

    const nextAnswer = { ...answer, [selectedAnchorId]: labelId };
    setAnswer(nextAnswer);
    const nextAnchor = question.anchors.find((anchor) => !nextAnswer[anchor.id]);
    setSelectedAnchorId(nextAnchor?.id ?? selectedAnchorId);
    setAnnouncement(
      `${labelFor(labelId)} asignada. ${nextAnchor ? "Selecciona una etiqueta para la siguiente zona." : "Todas las zonas están completas; puedes revisar o confirmar."}`,
    );
  };

  const clearSelected = () => {
    if (locked || !selectedAnchorId || !answer[selectedAnchorId]) return;
    const nextAnswer = { ...answer };
    const removedLabel = labelFor(nextAnswer[selectedAnchorId]);
    delete nextAnswer[selectedAnchorId];
    setAnswer(nextAnswer);
    setAnnouncement(`${removedLabel} eliminada de la zona seleccionada.`);
  };

  const completed = question.anchors.every((anchor) => Boolean(answer[anchor.id]));

  return (
    <div className={styles.challenge}>
      <div
        className={styles.surface}
        style={{ aspectRatio: `${question.surface.width} / ${question.surface.height}` }}
      >
        <Image
          src={question.surface.src}
          alt={question.surface.alt}
          fill
          sizes="(max-width: 768px) calc(100vw - 3rem), 30rem"
          unoptimized={question.surface.src.endsWith(".svg")}
          draggable={false}
        />
        <div className={styles.anchors} aria-label="Zonas para etiquetar">
          {question.anchors.map((anchor, index) => {
            const assignedLabel = labelFor(answer[anchor.id]);
            const selected = selectedAnchorId === anchor.id;
            return (
              <button
                key={anchor.id}
                type="button"
                className={`${styles.anchor} ${selected ? styles.anchorSelected : ""} ${assignedLabel ? styles.anchorAssigned : ""}`}
                style={{ left: `${anchor.point.x * 100}%`, top: `${anchor.point.y * 100}%` }}
                onClick={() => selectAnchor(anchor.id, index)}
                disabled={locked}
                aria-pressed={selected}
                aria-label={`Zona ${index + 1}: ${assignedLabel ?? "sin etiqueta"}`}
              >
                <span>{index + 1}</span>
                <strong>{assignedLabel ?? "Elegir"}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <section className={styles.labelPanel} aria-labelledby={`labels-${question.id}`}>
        <div className={styles.labelHeading}>
          <h3 id={`labels-${question.id}`}>Etiquetas</h3>
          <button
            type="button"
            onClick={clearSelected}
            disabled={locked || !selectedAnchorId || !answer[selectedAnchorId]}
          >
            <CrossIcon aria-hidden="true" /> Limpiar zona
          </button>
        </div>
        <div className={styles.labelBank}>
          {question.labels.map((label) => {
            const assignedAnchorId = Object.keys(answer).find(
              (anchorId) => answer[anchorId] === label.id,
            );
            const unavailable = Boolean(assignedAnchorId && assignedAnchorId !== selectedAnchorId);
            return (
              <button
                key={label.id}
                type="button"
                className={assignedAnchorId ? styles.labelAssigned : ""}
                onClick={() => assignLabel(label.id)}
                disabled={locked || !selectedAnchorId || unavailable}
                aria-pressed={answer[selectedAnchorId ?? ""] === label.id}
              >
                {label.label}
              </button>
            );
          })}
        </div>
      </section>

      <ol className={styles.assignmentList} aria-label="Resumen de asociaciones">
        {question.anchors.map((anchor, index) => (
          <li key={anchor.id}>
            <span>Zona {index + 1}</span>
            <strong>{labelFor(answer[anchor.id]) ?? "Sin etiqueta"}</strong>
          </li>
        ))}
      </ol>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <motion.button
        type="button"
        className={styles.confirmButton}
        disabled={locked || !completed}
        onClick={() => completed && onSubmit(answer)}
        whileTap={{ scale: 0.98 }}
      >
        <CheckIcon className="h-5 w-5" aria-hidden="true" />
        Confirmar etiquetas
      </motion.button>
    </div>
  );
}
