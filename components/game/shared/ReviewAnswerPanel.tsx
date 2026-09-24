import type { ReactNode } from "react";
import { ArrowIcon, MotionButton, RotateIcon } from "@/components/ui";
import type { ReviewAnswerEntry } from "./ReviewAnswerList";
import { ReviewAnswerList } from "./ReviewAnswerList";
import styles from "./ReviewAnswers.module.css";

export function ReviewAnswerPanel({
  entries,
  countLabel,
  title = "Historial de respuestas",
  description,
  progress,
  backAtTop = false,
  onBack,
  onReplay,
  backLabel = "Volver al resultado",
  replayLabel = "Jugar de nuevo",
  extraActions,
  initialOpenId,
}: {
  entries: ReviewAnswerEntry[];
  countLabel: string;
  title?: string;
  description?: string;
  progress?: { value: number; max: number };
  backAtTop?: boolean;
  onBack?: () => void;
  onReplay?: () => void;
  backLabel?: string;
  replayLabel?: string;
  extraActions?: ReactNode;
  initialOpenId?: string;
}) {
  const progressPercent = progress
    ? progress.max > 0
      ? Math.max(0, Math.min(100, (progress.value / progress.max) * 100))
      : 0
    : 0;

  return (
    <section className={styles.reviewPanel} aria-labelledby="review-answers-title">
      {backAtTop && onBack ? (
        <button
          className={styles.reviewBackButton}
          type="button"
          onClick={onBack}
          aria-label={backLabel}
        >
          <ArrowIcon />
        </button>
      ) : null}

      <div className={styles.reviewPanelHeading}>
        <div>
          <h1 id="review-answers-title">{title}</h1>
        </div>
        {!progress ? (
          <span className={styles.reviewPanelCount}>{countLabel}</span>
        ) : null}
      </div>

      {progress ? (
        <div className={styles.reviewPanelProgress}>
          <span>{countLabel}</span>
          <div
            className={styles.reviewPanelProgressTrack}
            role="progressbar"
            aria-label="Niveles superados"
            aria-valuetext={countLabel}
            aria-valuemin={0}
            aria-valuemax={progress.max}
            aria-valuenow={progress.value}
          >
            <span
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {description ? <p className={styles.reviewPanelDescription}>{description}</p> : null}

      <ReviewAnswerList entries={entries} initialOpenId={initialOpenId} />

      {(onBack && !backAtTop) || onReplay || extraActions ? (
        <div className={styles.reviewPanelActions}>
          {onBack && !backAtTop ? (
            <MotionButton variant="secondary" onClick={onBack} whileTap={{ scale: 0.98 }}>
              {backLabel}
            </MotionButton>
          ) : null}
          {onReplay ? (
            <MotionButton onClick={onReplay} whileTap={{ scale: 0.98 }}>
              <RotateIcon className="h-5 w-5" />
              {replayLabel}
            </MotionButton>
          ) : null}
          {extraActions}
        </div>
      ) : null}
    </section>
  );
}
