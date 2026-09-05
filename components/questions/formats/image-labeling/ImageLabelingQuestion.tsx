"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AnswerOption } from "@/components/questions/shared/AnswerOption";
import { ArrowIcon, CheckIcon, CrossIcon } from "@/components/ui";
import styles from "./ImageLabelingQuestion.module.css";
import questionStyles from "@/components/game/shared/QuestionScreen.module.css";
import type {
  AssignAllImageLabelingQuestion,
  ImageLabelingAnswer,
  ImageLabelingQuestion as ImageLabelingQuestionType,
  IdentifyOneImageLabelingQuestion,
} from "@/types/game";

type Props = {
  question: ImageLabelingQuestionType;
  locked: boolean;
  onSubmit: (answer: ImageLabelingAnswer | string) => void;
};

export function AssignAllImageLabelingReviewSurface({
  question,
  answer,
}: {
  question: AssignAllImageLabelingQuestion;
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

export function IdentifyOneImageLabelingReviewSurface({
  question,
  answer,
  isCorrect,
}: {
  question: IdentifyOneImageLabelingQuestion;
  answer: string | null;
  isCorrect: boolean;
}) {
  const correct = question.response.correctAnswer;
  return (
    <>
      <div
        className={styles.surface}
        style={{ aspectRatio: `${question.surface.width} / ${question.surface.height}` }}
        role="img"
        aria-label={`${question.surface.alt} Zona señalada. Elegida: ${answer ?? "sin respuesta"}. Correcta: ${correct}.`}
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
          <div
            className={`${styles.reviewAnchor} ${styles.singleReviewAnchor} ${isCorrect ? styles.reviewCorrect : styles.reviewWrong}`}
            style={{ left: `${question.target.x * 100}%`, top: `${question.target.y * 100}%` }}
          >
            <strong>{isCorrect ? correct : `Tu: ${answer ?? "Sin respuesta"}`}</strong>
            {!isCorrect && <small>Correcta: {correct}</small>}
          </div>
        </div>
      </div>
      <p className="sr-only">
        Elegida: {answer ?? "sin respuesta"}. Correcta: {correct}.
      </p>
    </>
  );
}

function IdentifyOneSurface({ question }: { question: IdentifyOneImageLabelingQuestion }) {
  return (
    <div
      className={styles.surface}
      style={{ aspectRatio: `${question.surface.width} / ${question.surface.height}` }}
      role="img"
      aria-label={`${question.surface.alt} Hay una única zona señalada para identificar.`}
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
        <div
          className={styles.singleTarget}
          style={{ left: `${question.target.x * 100}%`, top: `${question.target.y * 100}%` }}
        >
          ?
        </div>
      </div>
    </div>
  );
}

function AssignAllImageLabelingQuestion({
  question,
  locked,
  onSubmit,
}: {
  question: AssignAllImageLabelingQuestion;
  locked: boolean;
  onSubmit: (answer: ImageLabelingAnswer) => void;
}) {
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

function IdentifyOneImageLabelingQuestion({
  question,
  locked,
  onSubmit,
}: {
  question: IdentifyOneImageLabelingQuestion;
  locked: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked) onSubmit(value);
  };

  return (
    <div className={styles.challenge}>
      <IdentifyOneSurface question={question} />
      {question.response.kind === "choice" ? (
        <div className={styles.choiceGrid}>
          {question.response.options.map((option, index) => (
            <AnswerOption
              key={option}
              label={option}
              index={index}
              disabled={locked}
              onSelect={() => onSubmit(option)}
            />
          ))}
        </div>
      ) : (
        <form className={styles.textForm} onSubmit={submitText}>
          <label htmlFor={`image-label-answer-${question.id}`}>Escribe tu respuesta</label>
          <div className={questionStyles.textAnswerRow}>
            <input
              id={`image-label-answer-${question.id}`}
              className={questionStyles.textAnswerInput}
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Tu respuesta…"
              disabled={locked}
              autoComplete="off"
              autoFocus
            />
            <motion.button
              className={questionStyles.textSubmitButton}
              type="submit"
              disabled={locked || !answer.trim()}
              whileTap={{ scale: 0.96 }}
              aria-label="Enviar respuesta"
            >
              <ArrowIcon className="h-6 w-6" />
            </motion.button>
          </div>
          <p>No importan las mayúsculas, las tildes ni los espacios.</p>
        </form>
      )}
    </div>
  );
}

export function ImageLabelingQuestion(props: Props) {
  return props.question.task === "assign-all" ? (
    <AssignAllImageLabelingQuestion
      question={props.question}
      locked={props.locked}
      onSubmit={props.onSubmit}
    />
  ) : (
    <IdentifyOneImageLabelingQuestion
      question={props.question}
      locked={props.locked}
      onSubmit={props.onSubmit}
    />
  );
}
