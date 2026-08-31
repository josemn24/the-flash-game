"use client";

import Image from "next/image";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import { MotionButton } from "@/components/ui/MotionButton.client";
import {
  calculateProgressiveImageReveal,
  PROGRESSIVE_IMAGE_INITIAL_BLUR,
  PROGRESSIVE_IMAGE_INITIAL_SCALE,
} from "@/lib/progressiveImage";
import type { ImageSurface, QuestionVariant } from "@/types/game";
import styles from "@/components/ProgressiveImageQuestion.module.css";

type ProgressiveImageQuestionProps = {
  surface: ImageSurface;
  revealDuration: number;
  answerLabel?: string;
  answerPlaceholder?: string;
  locked: boolean;
  onSubmit: (answer: string) => void;
  onTimedResponseStart: () => void;
  variant?: QuestionVariant;
};

type ImageState = "loading" | "ready" | "error";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ProgressiveImageQuestion({
  surface,
  revealDuration,
  answerLabel = "¿Qué aparece en la imagen?",
  answerPlaceholder = "Tu respuesta…",
  locked,
  onSubmit,
  onTimedResponseStart,
  variant = "default",
}: ProgressiveImageQuestionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const lastMilestoneRef = useRef(0);
  const [imageState, setImageState] = useState<ImageState>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [announcement, setAnnouncement] = useState("Cargando imagen.");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (startedAt === null || imageState !== "ready") return;

    const reducedMotion = prefersReducedMotion();
    const updateProgress = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const exactProgress = calculateProgressiveImageReveal(elapsed, revealDuration);
      const displayedProgress = reducedMotion
        ? exactProgress >= 1
          ? 1
          : Math.floor(exactProgress * 4) / 4
        : exactProgress;
      setProgress(displayedProgress);

      const milestone = Math.min(4, Math.floor(exactProgress * 4));
      if (milestone > lastMilestoneRef.current) {
        lastMilestoneRef.current = milestone;
        setAnnouncement(`Imagen revelada al ${milestone * 25} %.`);
      }
      return exactProgress >= 1;
    };

    updateProgress();
    const interval = window.setInterval(() => {
      if (updateProgress()) window.clearInterval(interval);
    }, 100);
    return () => window.clearInterval(interval);
  }, [imageState, revealDuration, startedAt]);

  const handleImageLoaded = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    lastMilestoneRef.current = 0;
    const start = performance.now();
    setProgress(0);
    setStartedAt(start);
    setImageState("ready");
    setAnnouncement("Imagen preparada. Comienza el revelado.");
    onTimedResponseStart();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const retryLoad = () => {
    startedRef.current = false;
    lastMilestoneRef.current = 0;
    setProgress(0);
    setStartedAt(null);
    setImageState("loading");
    setAnnouncement("Reintentando la carga de la imagen.");
    setLoadAttempt((current) => current + 1);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = answer.trim();
    if (value && !locked && imageState === "ready") onSubmit(value);
  };

  const blur = (1 - progress) * PROGRESSIVE_IMAGE_INITIAL_BLUR;
  const scale = 1 + (1 - progress) * (PROGRESSIVE_IMAGE_INITIAL_SCALE - 1);
  const progressPercentage = Math.round(progress * 100);
  const unavailable = locked || imageState !== "ready";

  return (
    <section
      className={`${styles.root} ${variant === "flash-pop" ? styles.pop : ""}`}
      data-variant={variant}
      aria-label="Imagen progresivamente revelada"
    >
      <div className={styles.progressHeader}>
        <span>Revelado</span>
        <strong>{progressPercentage} %</strong>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Progreso de revelado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercentage}
      >
        <span style={{ width: `${progressPercentage}%` }} />
      </div>

      <div
        className={styles.imageFrame}
        style={
          {
            "--progressive-image-ratio": surface.width / surface.height,
            aspectRatio: `${surface.width} / ${surface.height}`,
          } as CSSProperties
        }
      >
        <Image
          key={`${surface.src}-${loadAttempt}`}
          src={surface.src}
          alt={surface.alt}
          fill
          preload
          sizes="(max-width: 768px) calc(100vw - 2rem), 48rem"
          className={surface.fit === "contain" ? styles.imageContain : styles.imageCover}
          style={{
            filter: `blur(${blur}px)`,
            objectPosition: surface.position,
            transform: `scale(${scale})`,
          }}
          onLoad={handleImageLoaded}
          onError={() => {
            if (startedRef.current) return;
            setImageState("error");
            setAnnouncement("No se pudo cargar la imagen.");
          }}
        />
        {imageState === "loading" && <p className={styles.loading}>Cargando imagen…</p>}
        {imageState === "error" && (
          <div className={styles.errorPanel} role="alert">
            <strong>No se pudo cargar la imagen.</strong>
            <span>El tiempo todavía no ha comenzado.</span>
            <MotionButton className={styles.retryButton} type="button" onClick={retryLoad}>
              Reintentar
            </MotionButton>
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <form className={styles.answerPanel} onSubmit={submit}>
        <label htmlFor="progressive-image-answer">{answerLabel}</label>
        <div className={styles.answerRow}>
          <input
            ref={inputRef}
            id="progressive-image-answer"
            type="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={answerPlaceholder}
            disabled={unavailable}
            autoComplete="off"
          />
          <MotionButton
            className={styles.submitButton}
            type="submit"
            disabled={unavailable || !answer.trim()}
            aria-label="Enviar respuesta"
          >
            <ArrowIcon className="h-6 w-6" />
          </MotionButton>
        </div>
        <p>Solo tienes un intento. No importan las mayúsculas, las tildes ni los espacios.</p>
      </form>
    </section>
  );
}
