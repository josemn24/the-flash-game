import styles from "@/components/game/shared/ReviewAnswers.module.css";
import { isMiniSudokuAnswer } from "@/lib/scoring";
import type { MiniSudokuAnswer } from "@/types/gameplay";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { ReviewProps } from "../../rendererTypes";

export function ReviewContent({
  question,
  result,
}: ReviewProps<PracticeQuestionOfType<"mini-sudoku">>) {
  const answer: MiniSudokuAnswer | null = isMiniSudokuAnswer(result.answer)
    ? (result.answer as MiniSudokuAnswer)
    : null;
  const details = result.details?.type === "mini-sudoku" ? result.details : undefined;
  return (
    <div className="grid gap-3">
      <div className={styles.sudokuReviewGrid} aria-label="Sudoku completado con la solución">
        {question.solution.map((correctValue, index) => {
          const isBlank = question.grid[index] === null;
          const chosenValue = isBlank ? answer?.[String(index)] : question.grid[index];
          const status = !isBlank
            ? styles.sudokuGiven
            : chosenValue === correctValue
              ? styles.sudokuCorrect
              : styles.sudokuWrong;
          return (
            <div key={index} className={`${styles.sudokuReviewCell} ${status}`}>
              <span>{correctValue}</span>
              {isBlank && <small>Tu valor: {chosenValue ?? "—"}</small>}
            </div>
          );
        })}
      </div>
      <div className={styles.answerBox}>
        <span>Casillas correctas</span>
        <strong>
          {details ? `${details.correctCells} de ${details.totalCells}` : "Sin datos"}
        </strong>
      </div>
    </div>
  );
}
