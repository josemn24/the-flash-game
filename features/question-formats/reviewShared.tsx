import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { AnswerValue } from "@/types/contracts";

export function answerLabel(value: AnswerValue | null) {
  if (value === null) return "Sin respuesta";
  if (Array.isArray(value)) return value.join(" → ");
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  if (typeof value === "object") return "Clasificación completada";
  return value;
}

export function AnswerPair({
  answer,
  correct,
}: {
  answer: AnswerValue | null;
  correct: AnswerValue;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={styles.answerBox}>
        <span>Tu respuesta</span>
        <strong>{answerLabel(answer)}</strong>
      </div>
      <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
        <span>Respuesta correcta</span>
        <strong>{answerLabel(correct)}</strong>
      </div>
    </div>
  );
}
