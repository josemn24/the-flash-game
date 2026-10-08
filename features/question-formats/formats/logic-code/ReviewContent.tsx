import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { logicCodeReviewResult } from "@/lib/question-formats/logic-code/review";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"logic-code">>) {
  const { submittedCodes, attemptCount } = logicCodeReviewResult(result);
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
          <span>
            {submittedCodes.length > 0 && attemptCount > submittedCodes.length
              ? "Último código enviado"
              : "Códigos enviados"}
          </span>
          {submittedCodes.length ? (
            <div className={styles.logicReviewAttempts}>
              {submittedCodes.map((code, index) => (
                <b
                  key={`${code}-${index}`}
                  className={index === submittedCodes.length - 1 ? styles.logicReviewLast : ""}
                >
                  {code}
                </b>
              ))}
            </div>
          ) : (
            <strong>{attemptCount > 0 ? "Códigos no disponibles" : "Sin respuesta"}</strong>
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
