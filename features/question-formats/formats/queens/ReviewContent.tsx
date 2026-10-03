import { QueensBoard } from "@/components/questions";
import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isQueensAnswer } from "@/lib/scoring";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({ question, result }: ReviewProps<PracticeQuestionOfType<"queens">>) {
  const answer = isQueensAnswer(result.answer, question.grid)
    ? result.answer
    : { queens: [], marks: [] };
  const details = result.details?.type === "queens" ? result.details : undefined;
  return (
    <div className="grid gap-3">
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
            {details?.placedQueens ?? answer.queens.length}/{question.grid.rows}
          </strong>
        </div>
        <div className={styles.answerBox}>
          <span>En conflicto</span>
          <strong>{details?.conflictingQueens ?? 0}</strong>
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
