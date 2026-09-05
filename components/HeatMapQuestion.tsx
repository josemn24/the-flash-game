"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { KeyboardEvent, MouseEvent, useState } from "react";
import { CheckIcon } from "@/components/icons";
import styles from "@/components/HeatMapQuestion.module.css";
import type {
  HeatMapAnswer,
  HeatMapQuestion as HeatMapQuestionType,
  ImageSurface,
  NormalizedPoint,
  QuestionVariant,
} from "@/types/game";

type HeatMapSurfaceProps = {
  surface: ImageSurface;
  selectedPoint?: NormalizedPoint;
  targetPoint?: NormalizedPoint;
  fullCreditRadius?: number;
  toleranceRadius?: number;
  onSelect?: (point: NormalizedPoint) => void;
};

export function HeatMapSurface({
  surface,
  selectedPoint,
  targetPoint,
  fullCreditRadius = 0,
  toleranceRadius = 0,
  onSelect,
}: HeatMapSurfaceProps) {
  const shortSide = Math.min(surface.width, surface.height);
  const selectPoint = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onSelect) return;
    if (event.detail === 0) return onSelect(selectedPoint ?? { x: 0.5, y: 0.5 });
    const bounds = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    });
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onSelect || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    const point = selectedPoint ?? { x: 0.5, y: 0.5 };
    onSelect({
      x: Math.min(
        1,
        Math.max(
          0,
          point.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
        ),
      ),
      y: Math.min(
        1,
        Math.max(
          0,
          point.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
        ),
      ),
    });
  };

  const content = (
    <>
      <Image
        src={surface.src}
        alt=""
        fill
        sizes="(max-width: 768px) calc(100vw - 3rem), 32rem"
        unoptimized={surface.src.endsWith(".svg")}
        draggable={false}
      />
      <svg
        className={styles.overlay}
        viewBox={`0 0 ${surface.width} ${surface.height}`}
        aria-hidden="true"
      >
        {targetPoint && toleranceRadius > 0 && (
          <circle
            className={styles.toleranceArea}
            cx={targetPoint.x * surface.width}
            cy={targetPoint.y * surface.height}
            r={toleranceRadius * shortSide}
          />
        )}
        {targetPoint && fullCreditRadius > 0 && (
          <circle
            className={styles.targetArea}
            cx={targetPoint.x * surface.width}
            cy={targetPoint.y * surface.height}
            r={fullCreditRadius * shortSide}
          />
        )}
        {selectedPoint && targetPoint && (
          <line
            className={styles.distanceLine}
            x1={selectedPoint.x * surface.width}
            y1={selectedPoint.y * surface.height}
            x2={targetPoint.x * surface.width}
            y2={targetPoint.y * surface.height}
          />
        )}
        {targetPoint && (
          <g className={styles.targetMarker}>
            <circle cx={targetPoint.x * surface.width} cy={targetPoint.y * surface.height} r="13" />
            <path
              d={`M ${targetPoint.x * surface.width - 7} ${targetPoint.y * surface.height} h 14 M ${targetPoint.x * surface.width} ${targetPoint.y * surface.height - 7} v 14`}
            />
          </g>
        )}
        {selectedPoint && (
          <g className={styles.selectedMarker}>
            <circle
              cx={selectedPoint.x * surface.width}
              cy={selectedPoint.y * surface.height}
              r="15"
            />
            <circle
              cx={selectedPoint.x * surface.width}
              cy={selectedPoint.y * surface.height}
              r="5"
            />
          </g>
        )}
      </svg>
    </>
  );

  if (!onSelect) {
    return (
      <div
        className={styles.surface}
        style={{ aspectRatio: `${surface.width} / ${surface.height}` }}
        role="img"
        aria-label={surface.alt}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.surface} ${styles.surfaceInteractive}`}
      style={{ aspectRatio: `${surface.width} / ${surface.height}` }}
      onClick={selectPoint}
      onKeyDown={moveWithKeyboard}
      aria-label={`${surface.alt} Pulsa sobre la imagen para colocar el marcador. Con teclado, pulsa Intro para empezar y usa las flechas para moverlo; Mayúsculas más flecha da pasos mayores.`}
    >
      {content}
    </button>
  );
}

export function HeatMapQuestion({
  question,
  locked,
  onSubmit,
  variant = "default",
}: {
  question: HeatMapQuestionType;
  locked: boolean;
  onSubmit: (answer: HeatMapAnswer) => void;
  variant?: QuestionVariant;
}) {
  const [answer, setAnswer] = useState<HeatMapAnswer | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const selectSurfacePoint = (point: NormalizedPoint) => {
    setAnswer(point);
    setAnnouncement(
      `Marcador en ${Math.round(point.x * 100)} por ciento horizontal y ${Math.round(point.y * 100)} por ciento vertical. Puedes corregirlo o confirmar.`,
    );
  };

  return (
    <div className={`${styles.challenge}`} data-variant={variant}>
      <HeatMapSurface
        surface={question.surface}
        selectedPoint={answer ?? undefined}
        onSelect={locked ? undefined : selectSurfacePoint}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <motion.button
        type="button"
        className={styles.confirmButton}
        disabled={locked || !answer}
        onClick={() => answer && onSubmit(answer)}
        whileTap={{ scale: 0.98 }}
      >
        <CheckIcon className="h-5 w-5" />
        Confirmar ubicación
      </motion.button>
    </div>
  );
}
