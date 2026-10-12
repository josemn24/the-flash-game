import styles from "@/components/game/shared/ReviewAnswers.module.css";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"logic-matrix">>) {
  const piecesById = new Map(question.pieces.map((piece) => [piece.id, piece]));
  const labelFor = (pieceId: string | null) =>
    pieceId ? (piecesById.get(pieceId)?.label ?? pieceId) : "Casilla vacía";
  const completedCells = question.cells.map((cell) => cell ?? question.correctOptionId);
  const answer = typeof result.answer === "string" ? result.answer : null;
  return (
    <div className="grid gap-3">
      <div className={styles.logicMatrixReviewGrid} aria-label="Matriz completada">
        {completedCells.map((pieceId, index) => {
          const piece = piecesById.get(pieceId);
          return (
            <div key={index} className={styles.logicMatrixReviewCell}>
              <span aria-hidden="true">{piece?.symbol}</span>
              <small>{labelFor(pieceId)}</small>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={styles.answerBox}>
          <span>Tu elección</span>
          <strong>{labelFor(answer)}</strong>
        </div>
        <div className={`${styles.answerBox} ${styles.answerBoxCorrect}`}>
          <span>Pieza correcta</span>
          <strong>{labelFor(question.correctOptionId)}</strong>
        </div>
      </div>
    </div>
  );
}
