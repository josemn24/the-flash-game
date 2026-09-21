import type { ReactNode } from "react";
import { MotionButton } from "@/components/ui";
import { RotateIcon } from "@/components/ui";
import type { ReviewAnswerEntry } from "./ReviewAnswerList";
import { ReviewAnswerList } from "./ReviewAnswerList";
import styles from "./ReviewAnswers.module.css";

export function ReviewAnswerPanel({
  entries,
  countLabel,
  eyebrow = "Desglose completo",
  title = "Historial de respuestas",
  description,
  onBack,
  onReplay,
  backLabel = "Volver al resultado",
  replayLabel = "Jugar de nuevo",
  extraActions,
  initialOpenId,
}: {
  entries: ReviewAnswerEntry[];
  countLabel: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  onBack?: () => void;
  onReplay?: () => void;
  backLabel?: string;
  replayLabel?: string;
  extraActions?: ReactNode;
  initialOpenId?: string;
}) {
  return (
    <section className={styles.reviewPanel} aria-labelledby="review-answers-title">
      <div className={styles.reviewPanelHeading}>
        <div>
          <p className={styles.reviewPanelEyebrow}>{eyebrow}</p>
          <h1 id="review-answers-title">{title}</h1>
        </div>
        <span className={styles.reviewPanelCount}>{countLabel}</span>
      </div>

      {description ? <p className={styles.reviewPanelDescription}>{description}</p> : null}

      <ReviewAnswerList entries={entries} initialOpenId={initialOpenId} />

      {onBack || onReplay || extraActions ? (
        <div className={styles.reviewPanelActions}>
          {onBack ? (
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
