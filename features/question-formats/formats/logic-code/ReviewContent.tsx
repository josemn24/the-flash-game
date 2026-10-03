import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"logic-code">>) {
  const details = result.details?.type === "logic-code" ? result.details : undefined;
  return (
    <div>
      <div className={styles.logicReviewClues}>
        {question.clues.map((clue) => (
          <div key={clue.code}>
            <strong>{clue.code}</strong>
            <span>{clue.hint}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Códigos enviados</span>
          {details?.submittedCodes.length ? (
            <div className={styles.logicReviewAttempts}>
              {details.submittedCodes.map((code, index) => (
                <b
                  key={`${code}-${index}`}
                  className={
                    index === details.submittedCodes.length - 1 ? styles.logicReviewLast : ""
                  }
                >
                  {code}
                </b>
              ))}
            </div>
          ) : (
            <strong>Sin respuesta</strong>
          )}
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Solución</span>
          <strong>{question.correctAnswer}</strong>
        </div>
      </div>
    </div>
  );
}
