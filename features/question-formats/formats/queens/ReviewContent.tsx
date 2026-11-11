import { QueensBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isQueensAnswer } from "@/lib/scoring";
import { calculateQueensDraftMetrics } from "@/lib/queens";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({ question, result }: ReviewProps<PracticeQuestionOfType<"queens">>) {
  const savedQueens = result.reviewState?.type === "queens" ? [...result.reviewState.queens] : null;
  const answer = isQueensAnswer(result.answer, question.grid)
    ? result.answer
    : { queens: savedQueens ?? [], marks: [] };
  const details = result.details?.type === "queens" ? result.details : undefined;
  const draftMetrics = savedQueens
    ? calculateQueensDraftMetrics(question, answer.queens)
    : undefined;
  return (
    <div className="grid gap-3">
      {details?.failureReason === "attempts_exhausted" ? (
        <p>Has agotado los tres intentos.</p>
      ) : null}
      {details?.timeoutPartialCredit && details.correctPlacements !== undefined ? (
        <p>
          Acertaste {details.correctPlacements} de {details.requiredPlacements} coronas por colocar.
        </p>
      ) : null}
      <div className={styles.queensReviewPair}>
        <div>
          <span className={styles.memoryGridLabel}>Tu tablero</span>
          <QueensBoard question={question} answer={answer} label="Tablero final del jugador" />
        </div>
        <div>
          <span className={styles.memoryGridLabel}>Solución</span>
          <QueensBoard
            question={question}
            answer={{ queens: question.solution, marks: [] }}
            label="Solución de Queens"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={styles.answerBox}>
          <span>Coronas</span>
          <strong>
            {details?.placedQueens ?? draftMetrics?.placedQueens ?? answer.queens.length}/
            {question.grid.rows}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>En conflicto</span>
          <strong>{details?.conflictingQueens ?? draftMetrics?.conflictingQueens ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Errores</span>
          <strong>{details?.incorrectAttempts ?? 0}</strong>
        </div>
        <div className={styles.answerBox}>
          <span>Marcas X</span>
          <strong>{details?.marksUsed ?? answer.marks.length}</strong>
        </div>
      </div>
    </div>
  );
}
