import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"estimation">>) {
  const details = result.details?.type === "estimation" ? result.details : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className={styles.answerBox}>
        <span>Tu estimación</span>
        <strong>
          {typeof result.answer === "number"
            ? `${result.answer} ${question.unit}`
            : "Sin respuesta"}
        </strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Valor real</span>
        <strong>
          {question.correctAnswer} {question.unit}
        </strong>
      </div>
      <div className={styles.answerBox}>
        <span>Diferencia</span>
        <strong>
          {typeof result.answer !== "number" || !details
            ? "—"
            : details.difference === 0
              ? "Exacta"
              : `${details.difference} ${question.unit} ${result.answer > question.correctAnswer ? "por encima" : "por debajo"}`}
        </strong>
      </div>
    </div>
  );
}
