import { HeatMapSurface } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"heat-map">>) {
  const details = result.details?.type === "heat-map" ? result.details : undefined;

  return (
    <div className="grid gap-3">
      <HeatMapSurface
        surface={question.surface}
        selectedPoint={details?.selectedPoint}
        targetPoint={question.target}
        fullCreditRadius={question.fullCreditRadius}
        toleranceRadius={question.toleranceRadius}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Tu selección</span>
          <strong>{details ? "Punto sobre la imagen" : "Sin respuesta"}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Zona objetivo</span>
          <strong>{question.targetLabel}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Precisión</span>
          <strong>{details ? `${Math.round(details.accuracy * 100)} %` : "—"}</strong>
          {details && (
            <small>Distancia: {(details.distance * 100).toFixed(1)} % del lado corto</small>
          )}
        </div>
      </div>
    </div>
  );
}
