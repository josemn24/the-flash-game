import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";
import { AnswerPair } from "../../reviewShared";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"progressive-clues">>) {
  const details = result.details?.type === "progressive-clues" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <AnswerPair answer={result.answer} correct={question.correctAnswer} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Pistas utilizadas</span>
          <strong>
            {details ? `${details.revealedClues} de ${details.totalClues}` : "Sin datos"}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>Máximo disponible</span>
          <strong>{details ? `${details.availablePoints} pts` : "—"}</strong>
        </div>
      </div>
    </div>
  );
}
