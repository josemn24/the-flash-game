import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isMiniNonogramAnswer } from "@/lib/scoring";
import type { MiniNonogramAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"mini-nonogram">>) {
  const answer: MiniNonogramAnswer | null = isMiniNonogramAnswer(result.answer)
    ? (result.answer as MiniNonogramAnswer)
    : null;
  const details = result.details?.type === "mini-nonogram" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.nonogramReviewGrid} aria-label="Solución del nonograma">
        {question.solution.map((isFilled, index) => {
          const selected = answer?.[String(index)] === true;
          const status = selected
            ? isFilled
              ? styles.nonogramCorrect
              : styles.nonogramWrong
            : isFilled
              ? styles.nonogramMissing
              : styles.nonogramEmpty;
          return (
            <div key={index} className={`${styles.nonogramReviewCell} ${status}`}>
              <span aria-hidden="true">{isFilled ? "●" : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={styles.answerBox}>
          <span>Rellenos correctos</span>
          <strong>{details?.correctFilled ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Rellenos erróneos</span>
          <strong>{details?.incorrectFilled ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Total objetivo</span>
          <strong>{details?.totalFilled ?? 0}</strong>
        </div>
      </div>
    </div>
  );
}
